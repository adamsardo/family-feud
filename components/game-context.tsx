"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  GameActions,
  GamePhase,
  GameState,
  Question,
  RoundHistoryEntry,
  ValidationResponse,
} from "@/types/game";
import { useQuestionPacks } from "@/hooks/use-question-packs";
import { looselyMatches, normalizeAnswer } from "@/lib/utils";
import { clearSnapshot, readSnapshot, writeSnapshot } from "@/lib/storage";

const defaultTeamColors = ["#ef4444", "#3b82f6"];

const STORAGE_KEY = "family-feud:game-state";
const STORAGE_VERSION = 1;
const MAX_HISTORY_ENTRIES = 50;

type InternalState = GameState & {
  stealOriginalTeamIndex?: 0 | 1;
};

type QuestionDeck = {
  order: number[];
  index: number;
};

// Backoff window for AI validation after failures
const AI_BACKOFF_MS = 60_000;

type PersistedPayload = {
  state: InternalState;
  deck: QuestionDeck;
};

const createShuffledIndices = (length: number): number[] => {
  const indices = Array.from({ length }, (_, i) => i);
  for (let current = indices.length - 1; current > 0; current -= 1) {
    const random = Math.floor(Math.random() * (current + 1));
    [indices[current], indices[random]] = [indices[random], indices[current]];
  }
  return indices;
};

const createDefaultDeck = (length: number): QuestionDeck => ({
  order: length > 0 ? createShuffledIndices(length) : [],
  index: 0,
});

const sanitizeTeam = (
  team: unknown,
  fallbackName: string,
  fallbackColor: string
): { name: string; color: string; score: number } => {
  if (!team || typeof team !== "object") {
    return { name: fallbackName, color: fallbackColor, score: 0 };
  }
  const candidate = team as Partial<{ name: string; color: string; score: number }>;
  return {
    name:
      typeof candidate.name === "string" && candidate.name.trim().length > 0
        ? candidate.name
        : fallbackName,
    color: typeof candidate.color === "string" ? candidate.color : fallbackColor,
    score:
      typeof candidate.score === "number" && Number.isFinite(candidate.score)
        ? candidate.score
        : 0,
  };
};

const matchQuestion = (question: unknown, pool: Question[]): Question | null => {
  if (!question || typeof question !== "object") return null;
  const candidate = question as Partial<Question>;
  if (typeof candidate.question !== "string") return null;
  const match = pool.find((q) => q.question === candidate.question);
  return match ?? null;
};

const sanitizeRound = (round: unknown, question: Question | null) => {
  if (!round || typeof round !== "object" || !question) return null;
  const candidate = round as Partial<{ strikes: number; revealed: boolean[]; roundPot: number }>;
  if (
    !Array.isArray(candidate.revealed) ||
    typeof candidate.roundPot !== "number" ||
    typeof candidate.strikes !== "number"
  ) {
    return null;
  }
  const revealed = question.answers.map((_, idx) =>
    typeof candidate.revealed?.[idx] === "boolean" ? candidate.revealed[idx]! : false
  );
  return {
    strikes: Math.max(0, Math.min(3, Math.floor(candidate.strikes))),
    revealed,
    roundPot: Math.max(0, candidate.roundPot),
  };
};

const sanitizeHistoryEntry = (entry: unknown): RoundHistoryEntry | null => {
  if (!entry || typeof entry !== "object") return null;
  const candidate = entry as Partial<RoundHistoryEntry>;
  if (typeof candidate.question !== "string") return null;
  const answers = Array.isArray(candidate.answers)
    ? candidate.answers.map((answer) => {
        if (!answer || typeof answer !== "object") {
          return { text: "", points: 0, revealed: false };
        }
        const casted = answer as Partial<RoundHistoryEntry["answers"][number]>;
        return {
          text: typeof casted.text === "string" ? casted.text : "",
          points:
            typeof casted.points === "number" && Number.isFinite(casted.points)
              ? casted.points
              : 0,
          revealed: typeof casted.revealed === "boolean" ? casted.revealed : false,
        };
      })
    : [];
  return {
    question: candidate.question,
    answers,
    strikes:
      typeof candidate.strikes === "number"
        ? Math.max(0, Math.min(3, Math.floor(candidate.strikes)))
        : 0,
    winningTeam:
      candidate.winningTeam === 0 || candidate.winningTeam === 1 ? candidate.winningTeam : null,
    awardedPoints:
      typeof candidate.awardedPoints === "number" && Number.isFinite(candidate.awardedPoints)
        ? Math.max(0, candidate.awardedPoints)
        : 0,
    occurredAt:
      typeof candidate.occurredAt === "number" && Number.isFinite(candidate.occurredAt)
        ? candidate.occurredAt
        : Date.now(),
  };
};

const createDefaultState = (): InternalState => ({
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
  history: [],
  stealOriginalTeamIndex: undefined,
});

const sanitizeState = (incoming: unknown, pool: Question[]): InternalState => {
  const base = createDefaultState();
  if (!incoming || typeof incoming !== "object") return base;
  const candidate = incoming as Partial<InternalState>;

  if (Array.isArray(candidate.teams) && candidate.teams.length === 2) {
    base.teams = [
      sanitizeTeam(candidate.teams[0], "Team A", defaultTeamColors[0]),
      sanitizeTeam(candidate.teams[1], "Team B", defaultTeamColors[1]),
    ] as [typeof base.teams[0], typeof base.teams[1]];
  }

  base.activeTeamIndex = candidate.activeTeamIndex === 1 ? 1 : 0;

  if (
    candidate.phase === "playing" ||
    candidate.phase === "steal" ||
    candidate.phase === "results"
  ) {
    base.phase = candidate.phase;
  }

  if (typeof candidate.voiceEnabled === "boolean") {
    base.voiceEnabled = candidate.voiceEnabled;
  }

  if (candidate.roundWinner === 0 || candidate.roundWinner === 1) {
    base.roundWinner = candidate.roundWinner;
  }

  const matchedQuestion = matchQuestion(candidate.currentQuestion, pool);
  base.currentQuestion = matchedQuestion;
  base.round = sanitizeRound(candidate.round, matchedQuestion);

  base.history = Array.isArray(candidate.history)
    ? candidate.history
        .map(sanitizeHistoryEntry)
        .filter((entry): entry is RoundHistoryEntry => entry !== null)
        .slice(-MAX_HISTORY_ENTRIES)
    : [];

  if (candidate.stealOriginalTeamIndex === 0 || candidate.stealOriginalTeamIndex === 1) {
    base.stealOriginalTeamIndex = candidate.stealOriginalTeamIndex;
  }

  return base;
};

const normalizeDeck = (deck: QuestionDeck | null, total: number): QuestionDeck => {
  if (total <= 0) {
    return { order: [], index: 0 };
  }
  if (!deck || !Array.isArray(deck.order)) {
    return createDefaultDeck(total);
  }
  const seen = new Set<number>();
  const order: number[] = [];
  for (const value of deck.order) {
    if (typeof value === "number" && value >= 0 && value < total && !seen.has(value)) {
      seen.add(value);
      order.push(value);
    }
  }
  for (let idx = 0; idx < total; idx += 1) {
    if (!seen.has(idx)) {
      order.push(idx);
    }
  }
  const index = Math.min(Math.max(deck.index ?? 0, 0), order.length);
  return {
    order: order.length > 0 ? order : createDefaultDeck(total).order,
    index,
  };
};

const loadInitialSnapshot = (pool: Question[]): { state: InternalState; deck: QuestionDeck } | null => {
  const snapshot = readSnapshot<PersistedPayload>(STORAGE_KEY);
  if (!snapshot || snapshot.version !== STORAGE_VERSION) return null;
  const payload = snapshot.payload;
  if (!payload || typeof payload !== "object") return null;
  return {
    state: sanitizeState(payload.state, pool),
    deck: normalizeDeck(payload.deck ?? null, pool.length),
  };
};

const finalizeRound = (
  snapshot: InternalState,
  winner: 0 | 1 | null,
  revealedOverride?: boolean[],
  awardedOverride?: number
): InternalState => {
  if (!snapshot.currentQuestion || !snapshot.round) return snapshot;
  if (snapshot.round.roundPot === 0 && snapshot.roundWinner !== null) return snapshot;

  const revealed = revealedOverride ?? snapshot.round.revealed;
  const awardedPoints = winner !== null ? awardedOverride ?? snapshot.round.roundPot : 0;

  const teams =
    winner !== null
      ? (snapshot.teams.map((team, idx) =>
          idx === winner ? { ...team, score: team.score + awardedPoints } : team
        ) as typeof snapshot.teams)
      : snapshot.teams;

  const historyEntry: RoundHistoryEntry = {
    question: snapshot.currentQuestion.question,
    answers: snapshot.currentQuestion.answers.map((answer, idx) => ({
      text: answer.text,
      points: answer.points,
      revealed: revealed[idx] ?? false,
    })),
    strikes: snapshot.round.strikes,
    winningTeam: winner,
    awardedPoints,
    occurredAt: Date.now(),
  };

  return {
    ...snapshot,
    teams,
    round: {
      ...snapshot.round,
      revealed,
      roundPot: 0,
    },
    roundWinner: winner,
    history: [...snapshot.history, historyEntry].slice(-MAX_HISTORY_ENTRIES),
  };
};

const GameContext = createContext<(InternalState & GameActions) | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { activePack } = useQuestionPacks();
  const pool = useMemo<Question[]>(
    () =>
      activePack.questions.map((question) => ({
        question: question.question,
        answers: question.answers.map((answer) => ({ text: answer.text, points: answer.points })),
      })),
    [activePack]
  );
  const [initialSnapshot] = useState(() =>
    typeof window === "undefined" ? null : loadInitialSnapshot(pool)
  );

  const [state, setState] = useState<InternalState>(
    () => initialSnapshot?.state ?? createDefaultState()
  );
  const deckRef = useRef<QuestionDeck>(
    initialSnapshot?.deck ?? createDefaultDeck(pool.length)
  );
  const stateRef = useRef(state);
  const packFingerprintRef = useRef<string>(`${activePack.id}:${activePack.updatedAt}`);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const persist = useCallback(
    (snapshotState: InternalState) => {
      if (typeof window === "undefined") return;
      const payload: PersistedPayload = {
        state: snapshotState,
        deck: deckRef.current,
      };
      writeSnapshot(STORAGE_KEY, {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        payload,
      });
    },
    []
  );

  useEffect(() => {
    persist(state);
  }, [state, persist]);

  const resetQuestionDeck = useCallback(() => {
    deckRef.current = createDefaultDeck(pool.length);
    persist(stateRef.current);
  }, [pool.length, persist]);

  const drawNextQuestion = useCallback((): Question | null => {
    if (pool.length === 0) return null;
    deckRef.current = normalizeDeck(deckRef.current, pool.length);
    let { order, index } = deckRef.current;
    if (order.length === 0) {
      deckRef.current = createDefaultDeck(pool.length);
      order = deckRef.current.order;
      index = deckRef.current.index;
    }
    if (index >= order.length) {
      deckRef.current = createDefaultDeck(pool.length);
      order = deckRef.current.order;
      index = deckRef.current.index;
    }
    const questionIndex = order[index];
    deckRef.current = {
      order,
      index: index + 1,
    };
    persist(stateRef.current);
    return typeof questionIndex === "number" ? pool[questionIndex] ?? null : null;
  }, [pool, persist]);

  const peekNextQuestion = useCallback((): Question | null => {
    if (pool.length === 0) return null;
    deckRef.current = normalizeDeck(deckRef.current, pool.length);
    const { order, index } = deckRef.current;
    if (order.length === 0) return null;
    if (index >= order.length) return null;
    const questionIndex = order[index];
    return typeof questionIndex === "number" ? pool[questionIndex] ?? null : null;
  }, [pool]);

  const getQuestionCounts = useCallback(
    () => ({
      remaining: Math.max(0, deckRef.current.order.length - deckRef.current.index),
      total: pool.length,
    }),
    [pool.length]
  );

  const startGame = useCallback(
    (teamAName: string, teamBName: string) => {
      resetQuestionDeck();
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
        roundWinner: null,
        history: [],
        stealOriginalTeamIndex: undefined,
      });
    },
    [resetQuestionDeck]
  );

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
      const points = s.currentQuestion.answers[index]?.points ?? 0;
      const revealed = s.round.revealed.map((value, idx) => (idx === index ? true : value));
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

  const backoffUntilRef = useRef<number>(0);

  const fetchValidation = useCallback(async (playerAnswer: string): Promise<ValidationResponse> => {
    const AI_DISABLED =
      process.env.NEXT_PUBLIC_DISABLE_AI === "true" || process.env.NEXT_PUBLIC_DISABLE_AI === "1";
    const now = Date.now();
    if (
      AI_DISABLED ||
      now < backoffUntilRef.current ||
      (typeof navigator !== "undefined" && navigator.onLine === false)
    ) {
      return { matched: false };
    }
    const current = stateRef.current.currentQuestion;
    if (!current) return { matched: false };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3200);
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
      if (!res.ok) {
        return { matched: false };
      }
      const data = (await res.json()) as ValidationResponse;
      if (typeof data.matched !== "boolean") {
        return { matched: false };
      }
      return data;
    } catch {
      // Enter backoff to avoid repeated slow attempts
      backoffUntilRef.current = Date.now() + AI_BACKOFF_MS;
      return { matched: false };
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const submitAnswer = useCallback(
    async (playerAnswer: string): Promise<ValidationResponse> => {
      const snapshot = stateRef.current;
      if (snapshot.phase !== "playing" || !snapshot.currentQuestion || !snapshot.round) {
        return { matched: false };
      }
      const answers = snapshot.currentQuestion.answers;
      const normalizedAnswers = answers.map((a) => normalizeAnswer(a.text));
      const normalizedPlayer = normalizeAnswer(playerAnswer);

      if (normalizedPlayer.length === 0) {
        registerStrike();
        return { matched: false };
      }

      let idx = normalizedAnswers.findIndex((value) => looselyMatches(value, normalizedPlayer));
      let timedOut: boolean | undefined;
      let confidence: number | undefined;

      if (idx === -1) {
        const result = await fetchValidation(playerAnswer);
        timedOut = result.timedOut;
        if (!result.matched || !result.matchedAnswer) {
          registerStrike();
          return { matched: false, timedOut };
        }
        const normalizedResult = normalizeAnswer(result.matchedAnswer);
        idx = normalizedAnswers.findIndex((value) => looselyMatches(value, normalizedResult));
        confidence = result.confidence;
        if (idx === -1) {
          registerStrike();
          return { matched: false, timedOut };
        }
      }

      if (snapshot.round.revealed[idx]) {
        registerStrike();
        return { matched: false, timedOut };
      }

      const canonical = answers[idx];
      const nextRevealed = snapshot.round.revealed.map((flag, i) => (i === idx ? true : flag));
      const willComplete = nextRevealed.every(Boolean);

      setState((s) => {
        if (!s.currentQuestion || !s.round) return s;
        const revealed = s.round.revealed.map((flag, i) => (i === idx ? true : flag));
        const roundPot = s.round.roundPot + canonical.points;
        const base: InternalState = {
          ...s,
          round: {
            ...s.round,
            revealed,
            roundPot,
          },
        };
        if (willComplete) {
          return finalizeRound(base, s.activeTeamIndex, revealed, roundPot);
        }
        return base;
      });

      return {
        matched: true,
        matchedAnswer: canonical.text,
        confidence: confidence ?? 1,
        points: canonical.points,
        timedOut,
      };
    },
    [fetchValidation, registerStrike]
  );

  const submitSteal = useCallback(
    async (playerAnswer: string): Promise<ValidationResponse> => {
      const snapshot = stateRef.current;
      if (snapshot.phase !== "steal" || !snapshot.currentQuestion || !snapshot.round) {
        return { matched: false };
      }
      const answers = snapshot.currentQuestion.answers;
      const normalizedAnswers = answers.map((a) => normalizeAnswer(a.text));
      const normalizedPlayer = normalizeAnswer(playerAnswer);
      const originalTeam =
        snapshot.stealOriginalTeamIndex ?? (snapshot.activeTeamIndex === 0 ? 1 : 0);

      const resolveFailedSteal = (timedOut?: boolean): ValidationResponse => {
        setState((s) => {
          if (!s.round || !s.currentQuestion) return s;
          const revealed = s.round.revealed.map(() => true);
          return finalizeRound(
            {
              ...s,
              round: {
                ...s.round,
                revealed,
              },
            },
            originalTeam as 0 | 1,
            revealed,
            s.round.roundPot
          );
        });
        return { matched: false, timedOut };
      };

      if (normalizedPlayer.length === 0) {
        return resolveFailedSteal();
      }

      let idx = normalizedAnswers.findIndex((value) => looselyMatches(value, normalizedPlayer));
      let timedOut: boolean | undefined;
      let confidence: number | undefined;

      if (idx === -1) {
        const result = await fetchValidation(playerAnswer);
        timedOut = result.timedOut;
        if (!result.matched || !result.matchedAnswer) {
          return resolveFailedSteal(timedOut);
        }
        const normalizedResult = normalizeAnswer(result.matchedAnswer);
        idx = normalizedAnswers.findIndex((value) => looselyMatches(value, normalizedResult));
        confidence = result.confidence;
        if (idx === -1) {
          return resolveFailedSteal(timedOut);
        }
      }

      if (snapshot.round.revealed[idx]) {
        return resolveFailedSteal();
      }

      const canonical = answers[idx];

      setState((s) => {
        if (!s.round || !s.currentQuestion) return s;
        const revealed = s.round.revealed.map(() => true);
        return finalizeRound(
          {
            ...s,
            round: {
              ...s.round,
              revealed,
            },
          },
          s.activeTeamIndex,
          revealed,
          s.round.roundPot
        );
      });

      return {
        matched: true,
        matchedAnswer: canonical.text,
        confidence: confidence ?? 1,
        points: canonical.points,
        timedOut,
      };
    },
    [fetchValidation]
  );

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

  const endGame = useCallback(() => {
    setState((s) => ({
      ...s,
      phase: "results" as GamePhase,
      currentQuestion: null,
      round: null,
    }));
  }, []);

  const clearHistory = useCallback(() => {
    setState((s) => ({ ...s, history: [] }));
  }, []);

  const resetPersistentState = useCallback(() => {
    deckRef.current = createDefaultDeck(pool.length);
    clearSnapshot(STORAGE_KEY);
    setState(createDefaultState());
  }, [pool.length]);

  const value = useMemo(
    () => ({
      ...state,
      startGame,
      toggleVoice,
      setNextQuestion,
      drawNextQuestion,
      peekNextQuestion,
      resetQuestionDeck,
      getQuestionCounts,
      submitAnswer,
      submitSteal,
      revealAnswerByIndex,
      registerStrike,
      endRoundAdvance,
      endGame,
      clearHistory,
      resetPersistentState,
    }),
    [
      state,
      startGame,
      toggleVoice,
      setNextQuestion,
      drawNextQuestion,
      peekNextQuestion,
      resetQuestionDeck,
      getQuestionCounts,
      submitAnswer,
      submitSteal,
      revealAnswerByIndex,
      registerStrike,
      endRoundAdvance,
      endGame,
      clearHistory,
      resetPersistentState,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
