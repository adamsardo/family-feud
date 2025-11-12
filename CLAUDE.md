# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies (use exact lockfile)
pnpm install

# Development server (hot reload)
pnpm dev

# Production build (includes type-check)
pnpm build

# Serve production build
pnpm start

# Lint (ESLint with Next.js config)
pnpm lint
```

Note: This project uses `pnpm` per AGENTS.md. If you notice `npm` commands being used, suggest `pnpm` instead.

## Architecture Overview

This is a Next.js 16 App Router application with a client-side game engine and Edge-runtime API endpoints for AI-powered answer validation and TTS.

### State Management

**GameContext** (`components/game-context.tsx`) is the single source of truth:
- Manages game state: teams, scores, active question, strikes, revealed answers, round pot
- Persists to localStorage (`family-feud:game-state`) with automatic hydration
- Uses a **question deck** (shuffled indices into `questions.json`) to ensure no repeats
- Exposes actions via context: `startGame`, `submitAnswer`, `submitSteal`, `revealAnswerByIndex`, `registerStrike`, `endRoundAdvance`, etc.

Key concepts:
- **Round pot**: Accumulates points as answers are revealed; banks to the winning team when the round ends
- **Steal phase**: Triggered after 3 strikes; other team gets one chance to answer; if correct they steal the pot, otherwise original team banks it
- **Phase transitions**: `setup` → `playing` → `steal` (conditional) → `playing` (next question) → `results` (when questions exhausted)

### API Endpoints (Edge Runtime)

1. **`/api/validate-answer`** - Uses OpenAI `gpt-4.1-mini` via Vercel AI SDK with structured output (Zod schema)
   - Accepts `{ question, boardAnswers, playerAnswer }`
   - Returns `{ matched, matchedAnswer?, confidence?, points?, timedOut? }`
   - 6-second timeout; requires confidence ≥ 0.6
   - Normalizes AI response to one of the canonical board answers

2. **`/api/tts/stream`** - Proxies ElevenLabs streaming TTS
   - Keeps API key server-side
   - Accepts `{ text, voiceId }`
   - Streams audio/mpeg back to client

### Question Data

`data/questions.json` contains the question pool. Each question has:
```json
{
  "question": "Name something...",
  "answers": [
    { "text": "Watch TV", "points": 40 },
    { "text": "Read", "points": 30 }
  ]
}
```

Points **must** sum to 100 per question (Family Feud convention).

### Key Utilities

- **`lib/utils.ts`**: `normalizeAnswer` (strip punctuation, lowercase), `looselyMatches` (fuzzy string comparison)
- **`lib/storage.ts`**: localStorage helpers (`readSnapshot`, `writeSnapshot`, `clearSnapshot`) with versioning

### Hooks

- **`use-questions.ts`**: Wraps `GameActions.drawNextQuestion` and `setNextQuestion`
- **`use-question-tts.ts`**: Fetches audio from `/api/tts/stream` and manages playback

## Critical Constraints

1. **Edge Runtime**: `/api` routes use `export const runtime = "edge"`. Avoid Node.js-only APIs (fs, crypto modules, etc.).
2. **Validation timeout**: 6 seconds (see `api/validate-answer/route.ts:60`). Gracefully treat timeouts as "no match".
3. **localStorage**: Game state persists per-browser. `STORAGE_VERSION` (in `game-context.tsx:29`) should increment if schema changes to invalidate old saves.
4. **Environment variables**: `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` are **required**. Missing keys cause silent failures (validation returns `matched: false`).

## Common Tasks

**Add a question**: Edit `data/questions.json`, ensure points sum to 100.

**Change validation model**: Edit `api/validate-answer/route.ts:66` (currently `gpt-4.1-mini`).

**Adjust confidence threshold**: Edit line 111 (currently `0.6`).

**Clear saved game state**: In browser devtools: `localStorage.removeItem("family-feud:game-state")`.

**Test validation endpoint manually**:
```bash
curl -X POST http://localhost:3000/api/validate-answer \
  -H "Content-Type: application/json" \
  -d '{"question":"Name something people do when they can'\''t sleep","boardAnswers":[{"text":"Watch TV","points":40}],"playerAnswer":"television"}'
```

## Code Style (from AGENTS.md)

- TypeScript, two-space indentation
- Components: PascalCase exports in kebab-case files (`game-board.tsx`)
- Server components by default; add `"use client"` only when needed
- Tailwind utilities ordered: layout → spacing → color
- Commit messages: imperative, ~72 chars, optional scope prefix
