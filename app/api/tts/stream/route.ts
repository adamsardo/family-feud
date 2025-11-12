import { NextRequest } from "next/server";

export const runtime = "edge";

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel
// Allow overriding the TTS model via env; default to ElevenLabs Turbo v2.5
// Docs: https://elevenlabs.io/docs/models#turbo-v25
const MODEL_ID = process.env.ELEVENLABS_TTS_MODEL_ID || "eleven_turbo_v2_5";
const OUTPUT_FORMAT = process.env.ELEVENLABS_TTS_OUTPUT_FORMAT || "mp3_44100_64";

const parseOptimizeStreamingLatency = (): number | null => {
  const raw = process.env.ELEVENLABS_TTS_OPTIMIZE_STREAMING_LATENCY;
  if (raw === undefined) return 3;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return 3;
  if (["none", "off", "default", "null"].includes(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 3;
  const clamped = Math.max(0, Math.min(4, Math.round(parsed)));
  return clamped;
};

const OPTIMIZE_STREAMING_LATENCY = parseOptimizeStreamingLatency();

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const parseVoiceSetting = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;
  const hasPercent = normalized.endsWith("%");
  const rawNumeric = Number(hasPercent ? normalized.slice(0, -1) : normalized);
  if (!Number.isFinite(rawNumeric)) return fallback;
  const ratio = hasPercent || rawNumeric > 1 ? rawNumeric / 100 : rawNumeric;
  return clamp01(ratio);
};

const STABILITY = parseVoiceSetting(process.env.ELEVENLABS_TTS_STABILITY, 0.4);
const SIMILARITY_BOOST = parseVoiceSetting(process.env.ELEVENLABS_TTS_SIMILARITY, 1);
const VOICE_SETTINGS = Object.freeze({
  stability: STABILITY,
  similarity_boost: SIMILARITY_BOOST,
});

const resolveContentType = (format: string): string => {
  if (format.startsWith("mp3")) return "audio/mpeg";
  if (format.startsWith("opus")) return "audio/ogg";
  if (format.startsWith("pcm")) return "audio/wave";
  if (format.startsWith("ulaw") || format.startsWith("alaw")) return "audio/basic";
  return "application/octet-stream";
};

const STREAM_CONTENT_TYPE = resolveContentType(OUTPUT_FORMAT);
const VOICE_SETTINGS_CACHE_TOKEN = `${VOICE_SETTINGS.stability.toFixed(3)}:${VOICE_SETTINGS.similarity_boost.toFixed(3)}`;

// Simple in-memory LRU cache (per edge runtime instance/region)
type CacheEntry = { updatedAt: number; bytes: Uint8Array; contentType: string };
const CACHE_MAX = Number(process.env.ELEVENLABS_TTS_CACHE_MAX || 20);
const CACHE_TTL_MS = Number(process.env.ELEVENLABS_TTS_CACHE_TTL_MS || 60 * 60 * 1000);
const cache = new Map<string, CacheEntry>();

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

const makeKey = (
  text: string,
  voiceId: string,
  model: string,
  format: string,
  optimizeLatency: number | null,
  voiceSettingsToken: string
): string =>
  `${hashString(text)}:${voiceId}:${model}:${format}:${optimizeLatency ?? "default"}:${voiceSettingsToken}`;

const buildStreamUrl = (voiceId: string): URL => {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`);
  url.searchParams.set("output_format", OUTPUT_FORMAT);
  if (OPTIMIZE_STREAMING_LATENCY !== null) {
    url.searchParams.set("optimize_streaming_latency", String(OPTIMIZE_STREAMING_LATENCY));
  }
  return url;
};

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

    const key = makeKey(
      text,
      voiceId,
      MODEL_ID,
      OUTPUT_FORMAT,
      OPTIMIZE_STREAMING_LATENCY,
      VOICE_SETTINGS_CACHE_TOKEN
    );
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

    const requestUrl = buildStreamUrl(voiceId);

    const t0 = Date.now();
    const res = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: STREAM_CONTENT_TYPE,
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: VOICE_SETTINGS,
      }),
    });
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
        putCache(key, { updatedAt: Date.now(), bytes, contentType: STREAM_CONTENT_TYPE });
      } catch {}
    })();

    return new Response(clientStream, {
      status: 200,
      headers: {
        "Content-Type": STREAM_CONTENT_TYPE,
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
    const key = makeKey(
      text,
      voiceId,
      modelId,
      OUTPUT_FORMAT,
      OPTIMIZE_STREAMING_LATENCY,
      VOICE_SETTINGS_CACHE_TOKEN
    );
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

    const requestUrl = buildStreamUrl(voiceId);

    const t0 = Date.now();
    const res = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: STREAM_CONTENT_TYPE,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: VOICE_SETTINGS,
      }),
    });
    const dur = Date.now() - t0;

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "TTS error");
      return new Response(errText || "TTS error", { status: 500 });
    }

    const [clientStream, cacheStream] = (res.body as ReadableStream).tee();
    (async () => {
      try {
        const bytes = await drainToBytes(cacheStream);
        putCache(key, { updatedAt: Date.now(), bytes, contentType: STREAM_CONTENT_TYPE });
      } catch {}
    })();

    return new Response(clientStream, {
      status: 200,
      headers: {
        "Content-Type": STREAM_CONTENT_TYPE,
        "Cache-Control": "no-store",
        "Server-Timing": `elevenlabs;dur=${dur}, cache;desc=MISS`,
      },
    });
  } catch (err) {
    return new Response("TTS failure", { status: 500 });
  }
}
