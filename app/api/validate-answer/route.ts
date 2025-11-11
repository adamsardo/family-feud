import { NextRequest } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

export const runtime = "edge";

type Answer = { text: string; points: number };

export async function POST(req: NextRequest) {
  try {
    const { question, boardAnswers, playerAnswer } = (await req.json()) as {
      question: string;
      boardAnswers: Answer[];
      playerAnswer: string;
    };
    if (
      typeof question !== "string" ||
      !Array.isArray(boardAnswers) ||
      typeof playerAnswer !== "string"
    ) {
      return new Response(JSON.stringify({ matched: false }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600);

    const answersStr = boardAnswers
      .map((a) => `${a.text.toUpperCase()} (${a.points})`)
      .join(", ");

    const system =
      "You are a Family Feud answer validator. Be generous and match conceptually similar answers. Reply with STRICT JSON only.";
    const prompt = `
Question: "${question}"
Board answers: ${answersStr}
Player answered: "${playerAnswer}"

Return ONLY JSON:
{
  "matched": boolean,
  "matchedAnswer": string | null,
  "confidence": number,  // 0..1
  "points": number | null
}
`;

    let json: any = null;
    try {
      const { text } = await generateText({
        model: openai("gpt-4.1-mini"),
        system,
        prompt,
        signal: controller.signal,
        maxTokens: 150,
      });
      json = JSON.parse(text);
    } catch {
      clearTimeout(timeout);
      return new Response(JSON.stringify({ matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timeout);
    }

    const confidence = typeof json?.confidence === "number" ? json.confidence : 0;
    const matched =
      json?.matched === true &&
      typeof json?.matchedAnswer === "string" &&
      confidence >= 0.8;

    if (!matched) {
      return new Response(JSON.stringify({ matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Normalize matchedAnswer to exactly one of the board answers by best exact case-insensitive match
    const matchedAnswerUpper = (json.matchedAnswer as string).trim().toUpperCase();
    const exact = boardAnswers.find(
      (a) => a.text.trim().toUpperCase() === matchedAnswerUpper
    );
    if (!exact) {
      // If AI returned a conceptual label that isn't exactly on the board, try a looser include match
      const fuzzy = boardAnswers.find((a) =>
        matchedAnswerUpper.includes(a.text.trim().toUpperCase())
      );
      if (!fuzzy) {
        return new Response(JSON.stringify({ matched: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          matched: true,
          matchedAnswer: fuzzy.text,
          confidence,
          points: fuzzy.points,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        matched: true,
        matchedAnswer: exact.text,
        confidence,
        points: exact.points,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(JSON.stringify({ matched: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";

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
    const timeout = setTimeout(() => controller.abort(), 600);

    let parsed: z.infer<typeof ResultSchema> | null = null;
    try {
      const result = await generateObject({
        model: openai("gpt-4.1-mini"),
        schema: ResultSchema,
        prompt,
        temperature: 0.2,
        maxTokens: 120,
        abortSignal: controller.signal,
      });
      parsed = result.object;
    } catch {
      // timeout or model failure -> treat as no match
      parsed = null;
    } finally {
      clearTimeout(timeout);
    }

    if (!parsed || parsed.matched !== true || !parsed.matchedAnswer) {
      return new Response(JSON.stringify({ matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Normalize to one of the provided board answers (case-insensitive match)
    const idx = boardAnswers.findIndex(
      (a) => a.text.trim().toLowerCase() === parsed!.matchedAnswer!.trim().toLowerCase()
    );
    if (idx === -1) {
      // model returned something not exactly in board — fail safe to no match
      return new Response(JSON.stringify({ matched: false }), {
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
    if ((response.confidence ?? 0) < 0.8) {
      return new Response(JSON.stringify({ matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ matched: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}


