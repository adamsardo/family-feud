"use client";

import { useGame } from "@/components/game-context";
import type { Question } from "@/types/game";

export function useQuestions(): {
  getNextQuestion: () => Question | null;
  peekNextQuestion: () => Question | null;
  remaining: number;
  total: number;
  reset: () => void;
} {
  const { drawNextQuestion, resetQuestionDeck, getQuestionCounts, peekNextQuestion } = useGame();
  const counts = getQuestionCounts();

  return {
    getNextQuestion: drawNextQuestion,
    peekNextQuestion,
    remaining: counts.remaining,
    total: counts.total,
    reset: resetQuestionDeck,
  };
}
