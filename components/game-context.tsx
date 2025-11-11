"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { GameActions, GamePhase, GameState, Question, ValidationResponse } from "@/types/game";

type InternalState = GameState & {
  stealOriginalTeamIndex?: 0 | 1;
};

const defaultTeamColors = ["#ef4444", "#3b82f6"];

const GameContext = createContext<(InternalState & GameActions) | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InternalState>(() => ({
    teams: [
      { name: "Team A", color: defaultTeamColors[0], score: 0 },
      { name: "Team B", color: defaultTeamColors[1], score: 0 },
    ],
    activeTeamIndex: 0,
    phase: "setup",
    currentQuestion: null,
    round: null,
    voiceEnabled: true,
    roundWinner: null,
  }));

  const startGame = useCallback((teamAName: string, teamBName: string) => {
    setState({
      teams: [
        { name: teamAName || "Team A", color: defaultTeamColors[0], score: 0 },
        { name: teamBName || "Team B", color: defaultTeamColors[1], score: 0 },
      ],
      activeTeamIndex: 0,
      phase: "setup",
      currentQuestion: null,
      round: null,
      voiceEnabled: true,
      stealOriginalTeamIndex: undefined,
      roundWinner: null,
    });
  }, []);

  const toggleVoice = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, voiceEnabled: enabled }));
  }, []);

  const setNextQuestion = useCallback((question: Question) => {
    const revealed = new Array(question.answers.length).fill(false);
    setState((s) => ({
      ...s,
      currentQuestion: question,
      phase: "playing" as GamePhase,
      round: { strikes: 0, revealed, roundPot: 0 },
      stealOriginalTeamIndex: undefined,
      roundWinner: null,
    }));
  }, []);

  const revealAnswerByIndex = useCallback((index: number) => {
    setState((s) => {
      if (!s.round || !s.currentQuestion) return s;
      if (s.round.revealed[index]) return s;
      const points = s.currentQuestion.answers[index].points;
      const revealed = s.round.revealed.slice();
      revealed[index] = true;
      return {
        ...s,
        round: {
          ...s.round,
          revealed,
          roundPot: s.round.roundPot + points,
        },
      };
    });
  }, []);

  const bankRoundToTeam = useCallback((teamIndex: 0 | 1) => {
    setState((s) => {
      if (!s.round) return s;
      const teams = s.teams.map((t, i) =>
        i === teamIndex ? { ...t, score: t.score + s.round!.roundPot } : t
      ) as [typeof s.teams[0], typeof s.teams[1]];
      return {
        ...s,
        teams,
        round: { ...s.round, roundPot: 0 },
      };
    });
  }, []);

  const endRoundAdvance = useCallback(() => {
    setState((s) => ({
      ...s,
      activeTeamIndex: (s.activeTeamIndex === 0 ? 1 : 0) as 0 | 1,
      phase: "playing",
      currentQuestion: null,
      round: null,
      stealOriginalTeamIndex: undefined,
      roundWinner: null,
    }));
  }, []);

  const registerStrike = useCallback(() => {
    setState((s) => {
      if (!s.round) return s;
      const strikes = s.round.strikes + 1;
      if (strikes >= 3) {
        const originalTeam = s.activeTeamIndex;
        const nextTeam = originalTeam === 0 ? 1 : 0;
        return {
          ...s,
          phase: "steal",
          round: { ...s.round, strikes: 3 },
          activeTeamIndex: nextTeam as 0 | 1,
          stealOriginalTeamIndex: originalTeam as 0 | 1,
        };
      }
      return { ...s, round: { ...s.round, strikes } };
    });
  }, []);

  const fetchValidation = useCallback(
    async (playerAnswer: string): Promise<ValidationResponse> => {
      const current = state.currentQuestion;
      if (!current) return { matched: false };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600);
      try {
        const res = await fetch("/api/validate-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            question: current.question,
            boardAnswers: current.answers,
            playerAnswer,
          }),
        });
        clearTimeout(timeoutId);
        if (!res.ok) return { matched: false };
        const data = (await res.json()) as ValidationResponse;
        if (typeof data.matched !== "boolean") return { matched: false };
        return data;
      } catch {
        clearTimeout(timeoutId);
        return { matched: false };
      }
    },
    [state.currentQuestion]
  );

  const submitAnswer = useCallback(
    async (playerAnswer: string): Promise<ValidationResponse> => {
      if (state.phase !== "playing" || !state.currentQuestion || !state.round) {
        return { matched: false };
      }
      const result = await fetchValidation(playerAnswer);
      if (!result.matched || !result.matchedAnswer) {
        // wrong — register strike
        registerStrike();
        return { matched: false };
      }

      // find index of the matched answer
      const idx = state.currentQuestion.answers.findIndex(
        (a) => a.text.toLowerCase() === result.matchedAnswer!.toLowerCase()
      );
      if (idx === -1) {
        // unknown match; treat as miss
        registerStrike();
        return { matched: false };
      }
      // if already revealed, treat as wrong (duplicate)
      if (state.round.revealed[idx]) {
        registerStrike();
        return { matched: false };
      }

      revealAnswerByIndex(idx);

      // After reveal, check if all are revealed
      setState((s) => {
        if (!s.currentQuestion || !s.round) return s;
        const allRevealed = s.round.revealed.every(Boolean);
        if (allRevealed) {
          // Bank immediately to active team, then wait for Next Question
          const active = s.activeTeamIndex;
          const teams = s.teams.map((t, i) =>
            i === active ? { ...t, score: t.score + s.round!.roundPot } : t
          ) as [typeof s.teams[0], typeof s.teams[1]];
          return {
            ...s,
            teams,
            round: { ...s.round, roundPot: 0 },
            roundWinner: null,
          };
        }
        return s;
      });

      return result;
    },
    [state.phase, state.currentQuestion, state.round, fetchValidation, registerStrike, revealAnswerByIndex]
  );

  const submitSteal = useCallback(
    async (playerAnswer: string): Promise<ValidationResponse> => {
      if (state.phase !== "steal" || !state.currentQuestion || !state.round) {
        return { matched: false };
      }
      const result = await fetchValidation(playerAnswer);
      const originalTeam =
        state.stealOriginalTeamIndex ?? (state.activeTeamIndex === 0 ? 1 : 0);

      if (!result.matched || !result.matchedAnswer) {
        // wrong steal — original team keeps pot
        bankRoundToTeam(originalTeam as 0 | 1);
        // Reveal all remaining answers after resolution
        setState((s) => {
          if (!s.round) return s;
          return {
            ...s,
            round: { ...s.round, revealed: s.round.revealed.map(() => true) },
          };
        });
        return { matched: false };
      }

      // successful steal: award entire round pot to stealing team (do not add extra points)
      bankRoundToTeam(state.activeTeamIndex);
      // Reveal all remaining answers after resolution
      setState((s) => {
        if (!s.round) return s;
        return {
          ...s,
          round: { ...s.round, revealed: s.round.revealed.map(() => true) },
        };
      });
      return result;
    },
    [
      state.phase,
      state.currentQuestion,
      state.round,
      state.activeTeamIndex,
      state.stealOriginalTeamIndex,
      fetchValidation,
      bankRoundToTeam,
    ]
  );

  const endGame = useCallback(() => {
    setState((s) => ({ ...s, phase: "results" as GamePhase }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      startGame,
      toggleVoice,
      setNextQuestion,
      submitAnswer,
      submitSteal,
      revealAnswerByIndex,
      registerStrike,
      bankRoundToTeam,
      endRoundAdvance,
      endGame,
    }),
    [
      state,
      startGame,
      toggleVoice,
      setNextQuestion,
      submitAnswer,
      submitSteal,
      revealAnswerByIndex,
      registerStrike,
      bankRoundToTeam,
      endRoundAdvance,
      endGame,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}


