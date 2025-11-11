import { NextRequest } from "next/server";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { looselyMatches, normalizeAnswer } from "@/lib/utils";

export const runtime = "edge";

const ResultSchema = z.object({
  matched: z.boolean(),
  matchedAnswer: z.string().optional(),
  confidence: z.number().optional(),
  points: z.number().optional(),
});

type Answer = { text: string; points: number };


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question: string = body?.question ?? "";
    const boardAnswers: Answer[] = Array.isArray(body?.boardAnswers) ? body.boardAnswers : [];
    const playerAnswer: string = body?.playerAnswer ?? "";

    if (!question || boardAnswers.length === 0 || !playerAnswer) {
      return new Response(JSON.stringify({ matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If API key is missing, fail fast to avoid client timeout toast
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const boardText = boardAnswers
      .map((a) => `${a.text.toUpperCase()} (${a.points})`)
      .join(", ");

    const prompt = [
      `Question: "${question}"`,
      `Board answers: ${boardText}`,
      `Player answered: "${playerAnswer}"`,
      "",
      "Does this answer match ANY board answer conceptually?",
      "Be GENEROUS - accept if core concept matches.",
      "Return ONLY JSON with fields: matched (boolean), matchedAnswer (UPPERCASE board answer text), confidence (0-1).",
    ].join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    let parsed: z.infer<typeof ResultSchema> | null = null;
    let timedOut = false;
    try {
      const result = await generateObject({
        model: openai("gpt-4.1-mini"),
        schema: ResultSchema,
        prompt,
        temperature: 0.1,
        maxOutputTokens: 60,
        abortSignal: controller.signal,
      });
      parsed = result.object;
    } catch (error) {
      // timeout or model failure -> treat as no match
      if (error instanceof Error && error.name === "AbortError") {
        timedOut = true;
      }
      parsed = null;
    } finally {
      clearTimeout(timeout);
    }

    if (!parsed || parsed.matched !== true || !parsed.matchedAnswer) {
      return new Response(JSON.stringify({ matched: false, timedOut }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Normalize to one of the provided board answers (case-insensitive match)
    const normalizedBoard = boardAnswers.map((a) => normalizeAnswer(a.text));
    const normalizedMatch = normalizeAnswer(parsed.matchedAnswer);
    const idx = normalizedBoard.findIndex((value) => looselyMatches(value, normalizedMatch));
    if (idx === -1) {
      return new Response(JSON.stringify({ matched: false, timedOut: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const canonical = boardAnswers[idx];
    const response = {
      matched: true,
      matchedAnswer: canonical.text,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
      points: canonical.points,
    };

    // Require confidence >= 0.8
    if ((response.confidence ?? 0) < 0.6) {
      return new Response(JSON.stringify({ matched: false, timedOut: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return new Response(JSON.stringify({ matched: false, timedOut }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}


