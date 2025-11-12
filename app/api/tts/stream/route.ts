import { NextRequest } from "next/server";

export const runtime = "edge";

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel
// Allow overriding the TTS model via env; default to ElevenLabs v3 alpha (eleven_v3)
// Docs: https://elevenlabs.io/docs/models#eleven-v3-alpha
const MODEL_ID = process.env.ELEVENLABS_TTS_MODEL_ID || "eleven_v3";
const OUTPUT_FORMAT = process.env.ELEVENLABS_TTS_OUTPUT_FORMAT || "mp3_16000_32";

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

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "Server-Timing": `elevenlabs;dur=${dur}`,
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

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "Server-Timing": `elevenlabs;dur=${dur}`,
      },
    });
  } catch (err) {
    return new Response("TTS failure", { status: 500 });
  }
}
