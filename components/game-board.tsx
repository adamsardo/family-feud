"use client";

import { useEffect, useMemo, useState } from "react";
import { useGame } from "./game-context";
import { useQuestions } from "@/hooks/use-questions";
import { useQuestionTTS } from "@/hooks/use-question-tts";
import { useSfx } from "@/hooks/use-sfx";
import { toast } from "sonner";
import { FamilyFeudHeader } from "./ui/family-feud-header";
import { RoundPotDisplay } from "./ui/round-pot-display";
import { AnswerCard } from "./ui/answer-card";
import { StrikeDisplay } from "./ui/strike-display";
import { useSurveySaysTTS } from "@/hooks/use-survey-says-tts";

export function GameBoard() {
  const {
    teams,
    activeTeamIndex,
    phase,
    currentQuestion,
    round,
    // voice always enabled
    submitAnswer,
    submitSteal,
    endRoundAdvance,
    setNextQuestion,
    endGame,
  } = useGame();
  const { getNextQuestion, peekNextQuestion } = useQuestions();
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const { playCorrect, playWrong, playNext } = useSfx();
  const surveySaysTTS = useSurveySaysTTS();

  const questionTTS = useQuestionTTS(true, currentQuestion?.question ?? null);
  useEffect(() => {
    if (!currentQuestion) return;
    const timeoutId = window.setTimeout(() => {
      setAnswer("");
      setFeedback(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [currentQuestion]);

  useEffect(() => {
    surveySaysTTS.preCache();
    return () => surveySaysTTS.cleanup();
  }, [surveySaysTTS]);

  const allRevealed = useMemo(() => {
    return !!round && !!currentQuestion && round.revealed.every(Boolean);
  }, [round, currentQuestion]);

  const roundEnded = useMemo(() => {
    if (!currentQuestion || !round) return false;
    return allRevealed || (phase === "steal" && round.roundPot === 0);
  }, [allRevealed, currentQuestion, phase, round]);


  // Pre-cache upcoming question as soon as the round ends
  useEffect(() => {
    if (!roundEnded) return;
    const nextQ = peekNextQuestion();
    if (nextQ) {
      questionTTS.preCache(nextQ.question);
    }
  }, [roundEnded, peekNextQuestion, questionTTS]);

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
    const nextQ = getNextQuestion();
    if (nextQ) {
      // Pre-cache upcoming question TTS before switching state
      questionTTS.preCache(nextQ.question);
      playNext();
      endRoundAdvance();
      setNextQuestion(nextQ);
    } else {
      toast("No more questions available", {
        description: "Showing final scores.",
      });
      endGame();
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black to-blue-950 text-white">
      {/* Header */}
      <FamilyFeudHeader />

      {/* Scores with Round Pot */}
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center gap-6 px-4 pb-4">
        <ScoreCard
          label={teams[0].name}
          score={teams[0].score}
          active={activeTeamIndex === 0}
          bump={activeTeamIndex === 0 && feedback === "correct" && phase === "playing"}
          color={teams[0].color}
        />

        {round && <RoundPotDisplay points={round.roundPot} />}

        <ScoreCard
          label={teams[1].name}
          score={teams[1].score}
          active={activeTeamIndex === 1}
          bump={activeTeamIndex === 1 && feedback === "correct" && phase === "playing"}
          color={teams[1].color}
        />
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        {/* Turn */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-semibold">
            {teams[activeTeamIndex].name.toUpperCase()}&rsquo;S TURN
          </div>
        </div>

        {/* Question */}
        <div className="mb-6 text-xl font-bold leading-7">
          {currentQuestion.question}
        </div>

        {/* Board: condensed two-column layout */}
        <div className="grid grid-cols-2 gap-3">
          {currentQuestion.answers.map((a, idx) => (
            <AnswerCard
              key={idx}
              revealed={round.revealed[idx]}
              text={a.text}
              points={a.points}
              index={idx}
            />
          ))}
        </div>

        {/* Strikes */}
        <StrikeDisplay strikes={round.strikes} />

        {/* Feedback (keep above sticky input) */}
        {feedback && (
          <div className={`mt-3 text-sm ${feedback === "correct" ? "text-emerald-400" : "text-red-400"}`}>
            {feedback === "correct" ? "Good Answer!" : "No Good - That answer is not on the board"}
          </div>
        )}

        {/* Input: keep visible without scrolling */}
        {!roundEnded && (
          <div className="sticky bottom-0 z-10 mt-4 -mx-4 px-4 pb-4 pt-2 backdrop-blur-sm [background:linear-gradient(to_top,rgba(2,6,23,0.9),rgba(2,6,23,0))]">
            <div className="flex gap-2">
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
