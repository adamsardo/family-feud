import { NextRequest } from "next/server";

export const runtime = "edge";

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text") || "";
    const voiceId = searchParams.get("voiceId") || DEFAULT_VOICE_ID;
    if (!text) {
      return new Response("Missing 'text' query.", { status: 400 });
    }
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return new Response("Missing ElevenLabs API key.", { status: 500 });
    }

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
          model_id: "eleven_multilingual_v2",
          optimize_streaming_latency: 4,
          output_format: "mp3_22050_32",
        }),
      }
    );

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "TTS error");
      return new Response(errText || "TTS error", { status: 500 });
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response("TTS failure", { status: 500 });
  }
}


