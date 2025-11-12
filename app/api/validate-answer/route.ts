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
      `
Determine if the provided answer matches any board answer conceptually, using a generous standard—accept the answer if the core idea aligns, even if details or wording differ.

- Review all board answers and compare with the provided answer.

- Focus on the underlying idea, accepting synonyms, paraphrases, or broad conceptual overlap.

- Only require a match if the main concept or intent is captured.

- Do NOT be strict: minor differences in phrasing, structure, or specificity are acceptable as long as the essential idea is present.

Before making a final call, consider:

  1. The key idea of the provided answer.

  2. The core idea of each board answer.

  3. Comparison for conceptual overlap.

- Reach your conclusion only after considering all candidates.

Output ONLY JSON with these fields:

- matched (boolean): true if any board answer matches conceptually, false otherwise.

- matchedAnswer: The UPPERCASE version of the best-matching board answer (if matched is true); if no match, leave as an empty string "".

- confidence: A number between 0 (no confidence) and 1 (absolute certainty), reflecting how strongly you feel about the match.

# Example

Input:
- Provided answer: "Plants need sunlight to grow."
- Board answers: ["PHOTOSYNTHESIS", "WATER", "SUNLIGHT", "SOIL"]

Internal reasoning (not output, not displayed to the user):
- Provided answer key idea: Plants need sunlight.
- Board answer "SUNLIGHT" core idea: Sunlight is important.
- Conceptual match found.

Output:
{
  "matched": true,
  "matchedAnswer": "SUNLIGHT",
  "confidence": 0.9
}

(Remember, actual examples may include longer or more ambiguous answers.)

# Important Instructions and Objective (Reminder)
Your task is to determine if the key idea of the provided answer matches any board answer conceptually, be GENEROUS in matching, and output ONLY the specified JSON with fields: matched, matchedAnswer (UPPERCASE), and confidence (0-1). Always reason before you conclude, but only the JSON should be returned.
      `,
    ].join("\n");

    // Keep request snappy to avoid disrupting gameplay
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    let parsed: z.infer<typeof ResultSchema> | null = null;
    let timedOut = false;
    try {
      const result = await generateObject({
        model: openai("gpt-4.1-mini"),
        schema: ResultSchema,
        prompt,
        temperature: 0.1,
        maxOutputTokens: 40,
        abortSignal: controller.signal,
      });
      parsed = result.object;
    } catch (err) {
      // timeout or model failure -> treat as no match (silently)
      let name = "";
      let message = "";
      if (err && typeof err === "object") {
        const obj = err as Record<string, unknown>;
        if (typeof obj.name === "string") name = obj.name;
        // Fallback to constructor name if available
        const ctor = obj.constructor as { name?: string } | undefined;
        if (!name && ctor && typeof ctor.name === "string") name = ctor.name;
        if (typeof obj.message === "string") message = obj.message;
      }
      const isAbort =
        String(name) === "AbortError" ||
        /abort/i.test(String(message)) ||
        /aborted/i.test(String(message)) ||
        /aborterror/i.test(String(message));
      timedOut = isAbort;
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

    // Require confidence >= 0.6
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
  } catch {
    // Surface a simple no-match on failures to avoid UI toasts
    return new Response(JSON.stringify({ matched: false, timedOut: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
