"use client";

import { useCallback, useMemo, useRef } from "react";
import questionsData from "@/data/questions.json";
import type { Question } from "@/types/game";

function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;
  while (currentIndex > 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

export function useQuestions(): {
  getNextQuestion: () => Question;
  remaining: number;
  total: number;
  reset: () => void;
} {
  const pool = useMemo<Question[]>(
    () => (questionsData as { questions: Question[] }).questions.slice(),
    []
  );

  const orderRef = useRef<number[]>(
    shuffle(Array.from({ length: pool.length }, (_, i) => i))
  );
  const indexRef = useRef(0);

  const getNextQuestion = useCallback((): Question => {
    if (pool.length === 0) {
      throw new Error("No questions available.");
    }
    if (indexRef.current >= orderRef.current.length) {
      orderRef.current = shuffle(Array.from({ length: pool.length }, (_, i) => i));
      indexRef.current = 0;
    }
    const nextIndex = orderRef.current[indexRef.current++];
    return pool[nextIndex];
  }, [pool]);

  const reset = useCallback(() => {
    orderRef.current = shuffle(Array.from({ length: pool.length }, (_, i) => i));
    indexRef.current = 0;
  }, [pool]);

  return {
    getNextQuestion,
    remaining: Math.max(0, orderRef.current.length - indexRef.current),
    total: pool.length,
    reset,
  };
}

