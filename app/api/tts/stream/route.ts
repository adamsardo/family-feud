import { NextRequest } from "next/server";

export const runtime = "edge";

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel
// Allow overriding the TTS model via env; default to ElevenLabs v3 alpha (eleven_v3)
// Docs: https://elevenlabs.io/docs/models#eleven-v3-alpha
const MODEL_ID = process.env.ELEVENLABS_TTS_MODEL_ID || "eleven_v3";
const OUTPUT_FORMAT = process.env.ELEVENLABS_TTS_OUTPUT_FORMAT || "mp3_16000_32";

// Simple in-memory LRU cache (per edge runtime instance/region)
type CacheEntry = { updatedAt: number; bytes: Uint8Array; contentType: string };
const CACHE_MAX = Number(process.env.ELEVENLABS_TTS_CACHE_MAX || 20);
const CACHE_TTL_MS = Number(process.env.ELEVENLABS_TTS_CACHE_TTL_MS || 60 * 60 * 1000);
const cache = new Map<string, CacheEntry>();

const enc = new TextEncoder();
const hex = (n: number) => n.toString(16).padStart(8, "0");
const hashString = (s: string): string => {
  // lightweight FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return hex(h);
};

const makeKey = (text: string, voiceId: string, model: string, format: string): string =>
  `${hashString(text)}:${voiceId}:${model}:${format}`;

const touch = (key: string) => {
  const v = cache.get(key);
  if (!v) return;
  cache.delete(key);
  cache.set(key, v);
};

const getCache = (key: string): CacheEntry | null => {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() - v.updatedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  touch(key);
  return v;
};

const putCache = (key: string, entry: CacheEntry) => {
  cache.set(key, entry);
  if (cache.size > CACHE_MAX) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey) cache.delete(oldestKey);
  }
};

async function drainToBytes(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = value as Uint8Array;
    chunks.push(chunk);
    total += chunk.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text") || "";
    const voiceId = searchParams.get("voiceId") || DEFAULT_VOICE_ID;

    if (!text.trim()) {
      return new Response("Missing 'text' query.", { status: 400 });
    }
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      // Soft-fail to avoid UX break if key is absent in local dev
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }

    const key = makeKey(text, voiceId, MODEL_ID, OUTPUT_FORMAT);
    const cached = getCache(key);
    if (cached) {
      const buffer = cached.bytes.buffer as ArrayBuffer;
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "no-store",
          "Server-Timing": `cache;desc=HIT`,
        },
      });
    }

    const t0 = Date.now();
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          // v3 is not intended for real-time usage; keep streaming here for simplicity
          // and allow output format override via env
          output_format: OUTPUT_FORMAT,
        }),
      }
    );
    const dur = Date.now() - t0;

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "TTS error");
      return new Response(errText || "TTS error", { status: 500 });
    }

    // Tee the stream so we can cache in the background without delaying the client
    const [clientStream, cacheStream] = (res.body as ReadableStream).tee();
    // Start caching asynchronously; no await
    (async () => {
      try {
        const bytes = await drainToBytes(cacheStream);
        putCache(key, { updatedAt: Date.now(), bytes, contentType: "audio/mpeg" });
      } catch {}
    })();

    return new Response(clientStream, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "Server-Timing": `elevenlabs;dur=${dur}, cache;desc=MISS`,
      },
    });
  } catch {
    return new Response("TTS failure", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      // Soft-fail to avoid UX break if key is absent in local dev
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }

    const { text = "", voiceId: voiceIdBody, modelId: modelIdBody } = await req.json().catch(() => ({}));
    const voiceId = voiceIdBody || DEFAULT_VOICE_ID;
    const modelId = modelIdBody || MODEL_ID;

    if (!text || !String(text).trim()) {
      return new Response("Missing 'text' in JSON body.", { status: 400 });
    }

    // Use streaming endpoint for consistent behavior with GET; client can still buffer via blob()
    const key = makeKey(text, voiceId, modelId, OUTPUT_FORMAT);
    const cached = getCache(key);
    if (cached) {
      const buffer = cached.bytes.buffer as ArrayBuffer;
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "no-store",
          "Server-Timing": `cache;desc=HIT`,
        },
      });
    }

    const t0 = Date.now();
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          output_format: OUTPUT_FORMAT,
        }),
      }
    );
    const dur = Date.now() - t0;

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "TTS error");
      return new Response(errText || "TTS error", { status: 500 });
    }

    const [clientStream, cacheStream] = (res.body as ReadableStream).tee();
    (async () => {
      try {
        const bytes = await drainToBytes(cacheStream);
        putCache(key, { updatedAt: Date.now(), bytes, contentType: "audio/mpeg" });
      } catch {}
    })();

    return new Response(clientStream, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "Server-Timing": `elevenlabs;dur=${dur}, cache;desc=MISS`,
      },
    });
  } catch (err) {
    return new Response("TTS failure", { status: 500 });
  }
}
