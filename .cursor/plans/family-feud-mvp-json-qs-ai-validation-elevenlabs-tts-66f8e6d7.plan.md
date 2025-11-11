<!-- 66f8e6d7-2d7c-4d96-837d-282e30fbdef8 a415e7b3-e395-413a-828e-d491e8c191ba -->
# Family Feud MVP (JSON Qs, AI validation, ElevenLabs TTS)

## Key decisions

- Scoring: Bank points per question and add to scoreboard only after the round resolves (closest to the real show).
- Steal phase view: Board as-is; unrevealed answers remain hidden.
- Questions source: Local `/data/questions.json` (5–8 answers each). AI used only for semantic answer validation.
- TTS: ElevenLabs Multilingual v2 via a server-side streaming proxy for minimal latency; client auto-plays on question change (after explicit user opt-in to satisfy autoplay policies).

## Files to add/update

- /types/game.ts: Question, Answer, Team, GamePhase, ValidationResponse types.
- /data/questions.json: Static questions array.
- /hooks/use-questions.ts: Randomize/rotate questions without repeats; simple cache.
- /components/game-context.tsx: Central state (teams, scores, strikes, phase, current question, revealed answers, pot, active team).
- /components/home-screen.tsx: Team setup (names), start button.
- /components/game-board.tsx: Scores header, current team highlight, question, answer board, strikes, input + submit, steal phase UI, next question.
- /components/results-screen.tsx: Winner/tie with play again/new game.
- /app/api/validate-answer/route.ts: Edge function calling OpenAI via Vercel AI SDK v6 with 600ms timeout and JSON schema output.
- /app/api/tts/stream/route.ts: Edge GET route that proxies to ElevenLabs streaming TTS with model_id=eleven_multilingual_v2 and optimize_streaming_latency.
- /hooks/use-question-tts.ts: Manages an HTMLAudioElement, builds `/api/tts/stream?text=...` URL, queues/stops playback on question change, and respects a user “Enable Voice” toggle.

## Data shape

- /data/questions.json
```json
{
  "questions": [
    {
      "question": "Name something people do when they can't sleep",
      "answers": [
        { "text": "Watch TV", "points": 40 },
        { "text": "Read", "points": 30 },
        { "text": "Check phone", "points": 18 },
        { "text": "Eat", "points": 8 },
        { "text": "Exercise", "points": 4 }
      ]
    }
  ]
}
```


## Answer validation (AI)

- Runtime: Edge for low latency.
- Input: { question: string, boardAnswers: {text, points}[], playerAnswer: string }
- Prompt: Provide question + full board; instruct model to be generous and return strict JSON only.
- JSON schema output:
```json
{
  "matched": true,
  "matchedAnswer": "WATCH TV",
  "confidence": 0.95,
  "points": 40
}
```

- Acceptance: confidence >= 0.8. Timeout: 600ms (AbortController). On timeout or invalid JSON → treat as no match.
- Model: OpenAI via Vercel AI SDK v6 (GPT-4.1). Keep tokens small; system prompt compact.

## TTS (minimal latency)

- Server proxy: `/api/tts/stream` (Edge, GET) keeps API key server-side and POSTs to ElevenLabs stream endpoint for the given `voiceId` (query optional, default from env), with body `{ text, model_id: 'eleven_multilingual_v2', optimize_streaming_latency: 4 }`. Returns a streaming audio response (e.g., audio/mpeg or opus) directly to the client.
- Client: `use-question-tts` creates a single HTMLAudioElement. On question change and if `voiceEnabled`, set `audio.src` to `/api/tts/stream?text=...` then `audio.play()`; stop the previous playback to avoid overlap. Provide a toggle on the board to enable/disable voice (required for autoplay).
- Notes: Use short texts (just the question), preconnect to the API route, and stop playback when leaving the screen.

## Game flow (state + UI)

- Start: Home screen → set names → initialize teams (auto-assign colors) and load first question.
- During a round: Active team submits text; validation endpoint decides; correct: reveal card, add points to round pot, continue; wrong: increment strikes; on 3rd strike, enter steal phase.
- Steal phase: Other team sees the same board (unrevealed remain hidden) and gets one guess; if matched, they take the pot; else original team takes the pot. Then “Next Question” advances and toggles active team.
- Round end: When all answers are revealed or after steal. Banked pot is added to the appropriate team, pot resets, strikes reset, next team turn.
- Exit: Results screen with winner/tie, play again (retain names), or new game.

## Error handling & UX

- Validation timeout → treat as miss; show brief toast; keep flow moving.
- TTS/network errors → fail silently with small toast; do not block input.
- If questions list exhausted → reshuffle or loop.
- Disabled submit on empty input; debounce rapid submissions; prevent double-submit while validating.

## Styling & animations

- Tailwind for layout and theme (dark gradient BG, glass cards, gold points). Flip animation on reveal; shake + red X on wrong; small pop for strike counter; quick score fly-up animation when pot is banked.

## Env & dependencies

- Env: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID`.
- Packages: `ai`, `openai` (Vercel AI SDK v6). Optional toast lib (e.g., `sonner`) and utility (`clsx`).

## Testing hooks

- Feature flag to disable TTS easily. Fallback to non-streaming if needed.
- Simple unit tests for scoring/turn logic in `game-context` (optional in MVP).

### To-dos

- [ ] Add game and validation types in /types/game.ts
- [ ] Create /data/questions.json with 15+ questions
- [ ] Build /hooks/use-questions.ts to rotate/shuffle questions
- [ ] Implement /components/game-context.tsx with scoring, pot, strikes, phases
- [ ] Create /components/home-screen.tsx for team setup and start
- [ ] Create /components/game-board.tsx with board, input, strikes, steal, next
- [ ] Create /components/results-screen.tsx with winner/tie actions
- [ ] Implement Edge /app/api/validate-answer/route.ts with 600ms timeout
- [ ] Implement Edge /app/api/tts/stream/route.ts proxy to ElevenLabs streaming
- [ ] Create /hooks/use-question-tts.ts and integrate enable/disable toggle
- [ ] Speak question on load/change in game board using the TTS hook
- [ ] Wire banked scoring and steal transfer per real-show rules
- [ ] Apply Tailwind theme and core animations for reveal/strike
- [ ] Add toasts and graceful fallbacks for validation/TTS failures