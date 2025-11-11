'use client';

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useGame } from "@/components/game-context";
import { useQuestions } from "@/hooks/use-questions";

export function HomeScreen() {
  const { startGame, setNextQuestion } = useGame();
  const { getNextQuestion } = useQuestions();
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");

  const canStart = useMemo(
    () => teamA.trim().length > 0 && teamB.trim().length > 0,
    [teamA, teamB]
  );

  const onStart = () => {
    if (!canStart) return;
    startGame(teamA.trim(), teamB.trim());
    const question = getNextQuestion();
    if (question) {
      setNextQuestion(question);
    } else {
      toast("No questions available", {
        description: "Add or refresh questions to start playing.",
      });
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black to-[#0b1020] text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-6">
        <h1 className="text-center text-2xl font-bold tracking-wide">Classic Family Feud</h1>
        <div className="space-y-2">
          <label className="text-sm text-white/80">Team 1</label>
          <input
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
            placeholder="Enter team 1 name"
            className="w-full rounded-md bg-white/10 px-3 py-2 outline-none ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-white/80">Team 2</label>
          <input
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
            placeholder="Enter team 2 name"
            className="w-full rounded-md bg-white/10 px-3 py-2 outline-none ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={onStart}
          disabled={!canStart}
          className="w-full rounded-md bg-gradient-to-r from-red-500 to-orange-500 py-2.5 font-semibold disabled:from-white/20 disabled:to-white/20 disabled:text-white/50 disabled:cursor-not-allowed"
        >
          Start Game
        </button>
      </div>
      <div className="mt-8 text-xs text-white/60">Pass-and-play • No accounts • Auto-resume</div>
    </div>
  );
}


