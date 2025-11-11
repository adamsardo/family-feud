# Family Feud

A web-based Family Feud game with AI-powered answer validation and text-to-speech for questions.

## What it does

Pass-and-play Family Feud for two teams. The AI validates your answers generously (so "mobile phone" matches "phone"), and optionally reads questions aloud using natural-sounding voices.

Points bank per question and get added to your score when the round ends. Get 3 strikes and the other team gets one chance to steal the pot.

## Features

- AI answer validation that understands synonyms and concepts
- Text-to-speech for questions (ElevenLabs)
- Proper Family Feud scoring rules (bank and steal mechanics)
- Custom team names
- Clean, responsive UI

## Setup 

**Requirements:**
- Node.js 20+
- OpenAI API key
- ElevenLabs API key

**Install:**

```bash
npm install
```

**Environment variables:**

Create a `.env.local` file:

```
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id_optional
```

**Run:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How to play

1. Enter team names and start
2. Active team types an answer
3. AI checks if it matches (generously)
4. Correct answers reveal and add to the pot
5. Wrong answers add strikes
6. 3 strikes = other team gets to steal
7. Round ends when all answers revealed or after steal
8. Points bank to the winning team
9. Next question, next team's turn

## Tech stack

- Next.js 16 (App Router, Edge runtime for APIs)
- React 19
- TypeScript
- Tailwind CSS v4
- OpenAI (via Vercel AI SDK) for answer validation
- ElevenLabs for text-to-speech
- Sonner for toasts

## Project structure

```
/app
  /api
    /tts/stream       # ElevenLabs proxy
    /validate-answer  # OpenAI validation
/components
  game-board.tsx      # Main game UI
  game-context.tsx    # State management
  home-screen.tsx     # Team setup
  results-screen.tsx  # Winner/tie screen
/hooks
  use-questions.ts    # Question rotation
  use-question-tts.ts # Audio playback
/types
  game.ts            # TypeScript definitions
/data
  questions.json     # Game questions
```

## Adding questions

Edit `/data/questions.json`:

```json
{
  "questions": [
    {
      "question": "Name something people do when they can't sleep",
      "answers": [
        { "text": "Watch TV", "points": 40 },
        { "text": "Read", "points": 30 }
      ]
    }
  ]
}
```

## Development notes

- Answer validation uses structured output (Zod schema) for reliability
- TTS streams through an Edge function to keep API keys server-side
- Game state is in-memory (no database)
- Validation has a 600ms timeout to keep the game moving
- Voice autoplay requires user interaction first (browser policy)

## Limitations

- No persistent storage (refresh = new game)
- Single device only (no multiplayer)
- Voice may not work on first load (autoplay restrictions)
- Validation sometimes misses creative answers (AI isn't perfect)