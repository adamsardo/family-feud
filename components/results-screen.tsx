"use client";

import React from "react";
import { useGame } from "./game-context";
import { useQuestions } from "@/hooks/use-questions";

export function ResultsScreen() {
  const { teams, startGame, setNextQuestion } = useGame();
  const { getNextQuestion, reset } = useQuestions();

  const [a, b] = teams;
  const winner =
    a.score === b.score ? "Tie Game!" : (a.score > b.score ? `${a.name} Wins!` : `${b.name} Wins!`);

  const onPlayAgain = () => {
    reset();
    startGame(a.name, b.name);
    setNextQuestion(getNextQuestion());
  };

  const onNewGame = () => {
    reset();
    startGame("", "");
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-black to-blue-950 text-white">
      <div className="w-full max-w-md p-6 text-center">
        <h2 className="mb-6 text-3xl font-extrabold">{winner}</h2>
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white/5 p-4">
            <div className="text-xs opacity-75">{a.name}</div>
            <div className="text-2xl font-bold">{a.score}</div>
          </div>
          <div className="rounded-lg bg-white/5 p-4">
            <div className="text-xs opacity-75">{b.name}</div>
            <div className="text-2xl font-bold">{b.score}</div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button
            className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500"
            onClick={onPlayAgain}
          >
            Play Again
          </button>
          <button
            className="w-full rounded-md bg-white/10 py-3 font-semibold text-white transition hover:bg-white/20"
            onClick={onNewGame}
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}


