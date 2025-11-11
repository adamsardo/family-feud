"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useGame } from "./game-context";
import { useQuestions } from "@/hooks/use-questions";
import { useQuestionTTS } from "@/hooks/use-question-tts";
import { useSfx } from "@/hooks/use-sfx";
import type { Question } from "@/types/game";
import { toast } from "sonner";

export function GameBoard() {
  const {
    teams,
    activeTeamIndex,
    phase,
    currentQuestion,
    round,
    voiceEnabled,
    toggleVoice,
    submitAnswer,
    submitSteal,
    endRoundAdvance,
    setNextQuestion,
    endGame,
  } = useGame();
  const { getNextQuestion } = useQuestions();
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const { playCorrect, playWrong, playNext } = useSfx();

  useQuestionTTS(voiceEnabled, currentQuestion?.question ?? null);
  useEffect(() => {
    if (currentQuestion) {
      setAnswer("");
      setFeedback(null);
    }
  }, [currentQuestion]);

  const allRevealed = useMemo(() => {
    return !!round && !!currentQuestion && round.revealed.every(Boolean);
  }, [round, currentQuestion]);

  const roundEnded = useMemo(() => {
    if (!currentQuestion || !round) return false;
    return allRevealed || (phase === "steal" && round.roundPot === 0);
  }, [allRevealed, currentQuestion, phase, round]);

  if (!currentQuestion || !round) return null;

  const onSubmit = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    const res = phase === "steal" ? await submitSteal(answer.trim()) : await submitAnswer(answer.trim());
    setSubmitting(false);
    setFeedback(res.matched ? "correct" : "wrong");
    if (res.matched) {
      playCorrect();
    } else {
      playWrong();
      if (res.timedOut) {
        toast("Validation timed out", { description: "Keeping the game moving." });
      }
    }
    setAnswer("");
  };

  const onNextQuestion = () => {
    playNext();
    const nextQ: Question = getNextQuestion();
    endRoundAdvance();
    setNextQuestion(nextQ);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black to-blue-950 text-white">
      {/* Header / Scores */}
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4">
        <div className="text-sm font-semibold tracking-wide opacity-80">CLASSIC FAMILY FEUD</div>
        <div className="flex items-center gap-2">
          <ScoreCard
            label={teams[0].name}
            score={teams[0].score}
            active={activeTeamIndex === 0}
            bump={activeTeamIndex === 0 && feedback === "correct" && phase === "playing"}
            color={teams[0].color}
          />
          <ScoreCard
            label={teams[1].name}
            score={teams[1].score}
            active={activeTeamIndex === 1}
            bump={activeTeamIndex === 1 && feedback === "correct" && phase === "playing"}
            color={teams[1].color}
          />
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-20">
        {/* Turn / Voice */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-semibold">
            {teams[activeTeamIndex].name.toUpperCase()}'S TURN
          </div>
          <label className="flex items-center gap-2 text-xs opacity-80">
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => toggleVoice(e.target.checked)}
            />
            Enable Voice
          </label>
        </div>

        {/* Question */}
        <div className="mb-6 text-xl font-bold leading-7">
          {currentQuestion.question}
        </div>

        {/* Board */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {currentQuestion.answers.map((a, idx) => (
            <AnswerCard
              key={idx}
              revealed={round.revealed[idx]}
              text={`${a.text.toUpperCase()}`}
              points={a.points}
            />
          ))}
        </div>

        {/* Strikes */}
        <div className="mt-6 h-8">
          <StrikeCounter strikes={round.strikes} />
        </div>

        {/* Input */}
        {!roundEnded && (
          <div className="mt-6 flex gap-2">
            <input
              className="flex-1 rounded-md border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-white/30"
              placeholder={phase === "steal" ? "Steal guess..." : "Type your answer..."}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
              disabled={submitting}
            />
            <button
              className="rounded-md bg-emerald-600 px-5 font-semibold text-white transition enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!answer.trim() || submitting}
              onClick={onSubmit}
            >
              {phase === "steal" ? "Submit Steal" : "Submit"}
            </button>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`mt-3 text-sm ${feedback === "correct" ? "text-emerald-400" : "text-red-400"}`}>
            {feedback === "correct" ? "Good Answer!" : "No Good - That answer is not on the board"}
          </div>
        )}

        {/* Next question */}
        {roundEnded && (
          <div className="mt-8 flex gap-2">
            <button
              className="w-full rounded-md bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500"
              onClick={onNextQuestion}
            >
              Next Question
            </button>
          </div>
        )}

        {/* Exit */}
        <div className="mt-14 flex">
          <button
            className="mx-auto text-sm text-white/70 underline underline-offset-4 hover:text-white"
            onClick={endGame}
          >
            Exit Game
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  score,
  active,
  bump,
  color,
}: {
  label: string;
  score: number;
  active: boolean;
  bump?: boolean;
  color: string;
}) {
  return (
    <div
      className={`rounded-md px-3 py-2 text-white transition-transform ${
        active ? "ring-2 ring-white/70" : "ring-0 opacity-80"
      } ${bump ? "scale-105" : "scale-100"}`}
      style={{ background: color }}
    >
      <div className="text-[10px] leading-none opacity-85">{label.toUpperCase()}</div>
      <div className="text-lg font-bold leading-tight">{score}</div>
    </div>
  );
}

function AnswerCard({
  revealed,
  text,
  points,
}: {
  revealed: boolean;
  text: string;
  points: number;
}) {
  return (
    <div
      className={`flex h-16 items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 backdrop-blur-sm transition ${
        revealed ? "bg-gradient-to-r from-red-600 to-orange-500" : ""
      }`}
    >
      <div className={`text-sm font-semibold ${revealed ? "text-white" : "text-white/70"}`}>
        {revealed ? text : "[hidden]"}
      </div>
      <div className={`text-xl font-extrabold ${revealed ? "text-yellow-200" : "text-white/40"}`}>
        {revealed ? points : ""}
      </div>
    </div>
  );
}

function StrikeCounter({ strikes }: { strikes: number }) {
  const symbols = ["X", "X", "X"].map((s, i) => (i < strikes ? "X" : "_"));
  return <div className="text-lg font-bold tracking-widest text-red-400">{symbols.join(" ")}</div>;
}


