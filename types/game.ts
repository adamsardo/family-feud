export type Answer = {
  text: string;
  points: number;
};

export type Question = {
  question: string;
  answers: Answer[];
};

export type Team = {
  name: string;
  color: string;
  score: number;
};

export type GamePhase = "setup" | "playing" | "steal" | "results";

export type ValidationResponse = {
  matched: boolean;
  matchedAnswer?: string;
  confidence?: number;
  points?: number;
};

export type RoundState = {
  strikes: number;
  revealed: boolean[]; // mirrors currentQuestion.answers
  roundPot: number; // banked when the round ends (question complete or after steal)
};

export type GameState = {
  teams: [Team, Team];
  activeTeamIndex: 0 | 1;
  phase: GamePhase;
  currentQuestion: Question | null;
  round: RoundState | null;
  voiceEnabled: boolean;
  // Winner for the current round's pot; set when all answers are revealed or after steal resolution.
  roundWinner: 0 | 1 | null;
};

export type GameActions = {
  startGame: (teamAName: string, teamBName: string) => void;
  toggleVoice: (enabled: boolean) => void;
  setNextQuestion: (question: Question) => void;
  submitAnswer: (playerAnswer: string) => Promise<ValidationResponse>;
  submitSteal: (playerAnswer: string) => Promise<ValidationResponse>;
  revealAnswerByIndex: (index: number) => void;
  registerStrike: () => void;
  bankRoundToTeam: (teamIndex: 0 | 1) => void;
  endRoundAdvance: () => void; // advance to next question + switch active team
  endGame: () => void;
};

