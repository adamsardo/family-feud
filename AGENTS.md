# Repository Guidelines
Keep Family Feud contributions consistent and production-ready by following the practices below.

## Project Structure & Module Organization
Next.js App Router code sits in `app/`; `page.tsx` wires `GameProvider`, and `app/api/{validate-answer,tts/stream}` exposes the AI-powered endpoints. UI building blocks, contexts, and animations live in `components/`, shared hooks in `hooks/`, and pure helpers (e.g., answer normalization) in `lib/`. Prompt data is centralized in `data/questions.json`, styles start in `app/globals.css`, and any media assets belong in `public/`. Update or add TypeScript contracts under `types/` so API responses stay aligned with the UI.

## Build, Test, and Development Commands
- `pnpm install` — install dependencies exactly as locked.
- `pnpm dev` — hot-reload server on `http://localhost:3000`.
- `pnpm lint` — run ESLint (`eslint-config-next` + TypeScript); required before review.
- `pnpm build` — production compile and type-check.
- `pnpm start` — serve the compiled output to mimic deployment.

## Coding Style & Naming Conventions
Use TypeScript, two-space indentation, and prefer small modules. Components and hooks are PascalCase exports in kebab-cased filenames (`game-board.tsx`), while utilities stay camelCase. Default to server components; add `"use client"` only when browser APIs or React state are necessary. Tailwind utilities should be ordered predictably (layout → spacing → color) to keep diffs readable, and derived constants belong in `lib/` rather than embedded in JSX.

## Testing Guidelines
Automated tests are not yet committed, so new behaviors must ship with coverage alongside the change (e.g., `components/__tests__/game-board.spec.tsx` or `lib/__tests__/utils.spec.ts`). Use Vitest + React Testing Library or Playwright, add the script to `package.json`, and document how to run it in the PR. Until a suite exists, run `pnpm dev` and manually exercise setup → gameplay → results, plus `/api/validate-answer` with representative payloads. Treat regressions in scoring or audio playback as release blockers.

## Commit & Pull Request Guidelines
Follow the existing history: short, imperative subjects near 72 characters, optionally prefixed with a scope (`chore: sync local changes`, `Refactor answer validation logic…`). PRs should summarize intent, list risky areas, reference issues, and include screenshots or short clips for UI/audio tweaks. Mention schema or `.env.local` requirements explicitly.

## Security & Configuration Notes
Store `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, and optional `ELEVENLABS_VOICE_ID` in `.env.local`; never commit secrets. Edge routes should avoid Node-only globals and log only sanitized strings. Rotate keys immediately if exposed and document new secrets in the PR checklist.
