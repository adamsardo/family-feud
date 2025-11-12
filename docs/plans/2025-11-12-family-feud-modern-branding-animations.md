# Family Feud Modern Branding & Animation Enhancement

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the game into a Steve Harvey-era Family Feud experience with LED board aesthetics, dramatic strike animations, "Survey Says!" TTS moments, and smooth Framer Motion animations.

**Architecture:** Component-based enhancement using Framer Motion for animations, ElevenLabs TTS for "Survey Says!" moment, extracted reusable UI components with LED-style glow effects, and performance-optimized GPU-accelerated animations. Maintains existing game logic in GameContext while adding visual polish layer.

**Tech Stack:** Next.js 16, React, TypeScript, Framer Motion 12.23.24, ElevenLabs API, Tailwind CSS, Web Audio API

---

## Task 1: Create Number Counter Hook

**Files:**
- Create: `hooks/use-number-counter.ts`
- Test: Manual verification in subsequent tasks

**Step 1: Create the number counter hook**

Create `hooks/use-number-counter.ts`:

```typescript
import { useEffect, useState } from "react";

export function useNumberCounter(
  target: number,
  options: {
    duration?: number;
    startFrom?: number;
  } = {}
) {
  const { duration = 600, startFrom = 0 } = options;
  const [current, setCurrent] = useState(startFrom);

  useEffect(() => {
    if (target === current) return;

    const startTime = Date.now();
    const startValue = current;
    const delta = target - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + delta * eased);

      setCurrent(nextValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration, current]);

  return current;
}
```

**Step 2: Commit**

```bash
git add hooks/use-number-counter.ts
git commit -m "feat: add number counter animation hook"
```

---

## Task 2: Create Survey Says TTS Hook

**Files:**
- Create: `hooks/use-survey-says-tts.ts`

**Step 1: Create Survey Says TTS hook with caching**

Create `hooks/use-survey-says-tts.ts`:

```typescript
import { useCallback, useRef, useState } from "react";

export function useSurveySaysTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cachedUrlRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const preCache = useCallback(async (voiceId?: string) => {
    if (cachedUrlRef.current) return; // Already cached

    try {
      setIsLoading(true);
      const response = await fetch("/api/tts/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Survey says!",
          voiceId,
        }),
      });

      if (!response.ok) {
        console.error("Failed to pre-cache Survey Says audio");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      cachedUrlRef.current = url;

      // Pre-load audio element
      if (!audioRef.current) {
        audioRef.current = new Audio(url);
        audioRef.current.volume = 0.8;
      } else {
        audioRef.current.src = url;
      }
    } catch (error) {
      console.error("Error pre-caching Survey Says:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const play = useCallback(async (): Promise<void> => {
    if (!audioRef.current || !cachedUrlRef.current) {
      console.warn("Survey Says audio not cached");
      return Promise.resolve();
    }

    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();

      // Return promise that resolves when audio finishes
      return new Promise((resolve) => {
        const onEnded = () => {
          audioRef.current?.removeEventListener("ended", onEnded);
          resolve();
        };
        audioRef.current?.addEventListener("ended", onEnded);
      });
    } catch (error) {
      console.error("Error playing Survey Says:", error);
      return Promise.resolve();
    }
  }, []);

  const cleanup = useCallback(() => {
    if (cachedUrlRef.current) {
      URL.revokeObjectURL(cachedUrlRef.current);
      cachedUrlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  return { preCache, play, cleanup, isLoading };
}
```

**Step 2: Commit**

```bash
git add hooks/use-survey-says-tts.ts
git commit -m "feat: add Survey Says TTS hook with caching"
```

---

## Task 3: Create Family Feud Header Component

**Files:**
- Create: `components/ui/family-feud-header.tsx`

**Step 1: Create header component with logo**

Create `components/ui/family-feud-header.tsx`:

```typescript
"use client";

import Image from "next/image";

export function FamilyFeudHeader() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative">
        <Image
          src="/Logo_of_Family_Feud.png"
          alt="Family Feud"
          width={220}
          height={80}
          priority
          className="drop-shadow-[0_0_20px_rgba(255,120,0,0.3)]"
        />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/ui/family-feud-header.tsx
git commit -m "feat: add Family Feud logo header component"
```

---

## Task 4: Create Round Pot Display Component

**Files:**
- Create: `components/ui/round-pot-display.tsx`

**Step 1: Create round pot display with animated counter**

Create `components/ui/round-pot-display.tsx`:

```typescript
"use client";

import { useNumberCounter } from "@/hooks/use-number-counter";
import { motion } from "framer-motion";

export function RoundPotDisplay({ points }: { points: number }) {
  const displayValue = useNumberCounter(points, { duration: 600 });

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
        On The Board
      </div>
      <motion.div
        className="text-3xl font-extrabold tabular-nums text-yellow-400"
        style={{
          textShadow: "0 0 20px rgba(250, 204, 21, 0.6), 0 0 40px rgba(250, 204, 21, 0.3)",
        }}
        animate={points > 0 ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {displayValue}
      </motion.div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/ui/round-pot-display.tsx
git commit -m "feat: add round pot display with animated counter"
```

---

## Task 5: Create Survey Says Overlay Component

**Files:**
- Create: `components/ui/survey-says-overlay.tsx`

**Step 1: Create overlay component with animation**

Create `components/ui/survey-says-overlay.tsx`:

```typescript
"use client";

import { motion, AnimatePresence } from "framer-motion";

export function SurveySaysOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="text-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div
              className="text-6xl font-extrabold uppercase tracking-wider text-white md:text-7xl"
              style={{
                textShadow:
                  "0 0 30px rgba(255,120,0,0.8), 0 0 60px rgba(255,120,0,0.4), 4px 4px 0 rgba(0,0,0,0.5)",
                WebkitTextStroke: "2px rgba(0,0,0,0.3)",
              }}
            >
              Survey Says!
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Commit**

```bash
git add components/ui/survey-says-overlay.tsx
git commit -m "feat: add Survey Says overlay component"
```

---

## Task 6: Create Answer Card Component with Flip Animation

**Files:**
- Create: `components/ui/answer-card.tsx`

**Step 1: Create answer card with flip animation**

Create `components/ui/answer-card.tsx`:

```typescript
"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNumberCounter } from "@/hooks/use-number-counter";

interface AnswerCardProps {
  revealed: boolean;
  text: string;
  points: number;
  index: number;
}

export function AnswerCard({ revealed, text, points, index }: AnswerCardProps) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [hasFlipped, setHasFlipped] = useState(revealed);
  const displayPoints = useNumberCounter(revealed ? points : 0, {
    duration: 600,
    startFrom: 0,
  });

  useEffect(() => {
    if (revealed && !hasFlipped) {
      setIsFlipping(true);
      const timer = setTimeout(() => {
        setIsFlipping(false);
        setHasFlipped(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [revealed, hasFlipped]);

  const cardVariants = {
    hidden: {
      rotateY: 0,
    },
    revealed: {
      rotateY: 360,
      transition: {
        duration: 0.6,
        ease: "easeInOut",
      },
    },
  };

  return (
    <motion.div
      className="perspective-1000"
      variants={cardVariants}
      animate={isFlipping ? "revealed" : "hidden"}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div
        className={`flex h-12 items-center justify-between rounded-lg border px-3 transition-all duration-300 ${
          revealed
            ? "border-orange-500/50 bg-gradient-to-r from-red-600 to-orange-500 shadow-[inset_0_0_20px_rgba(255,120,0,0.4),0_0_30px_rgba(255,120,0,0.5)]"
            : "border-white/10 bg-slate-900/90 shadow-sm"
        }`}
      >
        <div
          className={`text-xs font-bold transition-colors ${
            revealed ? "text-white" : "text-white/50"
          }`}
        >
          {revealed ? text.toUpperCase() : "[HIDDEN]"}
        </div>
        <div
          className={`text-lg font-extrabold tabular-nums transition-colors ${
            revealed ? "text-yellow-200" : "text-white/30"
          }`}
          style={
            revealed
              ? { textShadow: "0 0 10px rgba(253, 224, 71, 0.5)" }
              : undefined
          }
        >
          {revealed ? displayPoints : ""}
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 2: Add perspective utilities to globals.css**

Modify `app/globals.css` - add after the Tailwind directives:

```css
.perspective-1000 {
  perspective: 1000px;
}
```

**Step 3: Commit**

```bash
git add components/ui/answer-card.tsx app/globals.css
git commit -m "feat: add answer card with flip animation"
```

---

## Task 7: Create Strike Display Component

**Files:**
- Create: `components/ui/strike-display.tsx`

**Step 1: Create strike display with animated X elements**

Create `components/ui/strike-display.tsx`:

```typescript
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export function StrikeDisplay({ strikes }: { strikes: number }) {
  const [displayedStrikes, setDisplayedStrikes] = useState(0);

  useEffect(() => {
    if (strikes > displayedStrikes) {
      // Animate in new strike
      const timer = setTimeout(() => {
        setDisplayedStrikes(strikes);
      }, 50);
      return () => clearTimeout(timer);
    } else if (strikes < displayedStrikes) {
      // Reset (new round)
      setDisplayedStrikes(strikes);
    }
  }, [strikes, displayedStrikes]);

  return (
    <div className="flex min-h-[80px] items-center justify-center gap-4">
      <AnimatePresence mode="popLayout">
        {Array.from({ length: displayedStrikes }).map((_, i) => (
          <motion.div
            key={`strike-${i}`}
            initial={{ scale: 0, rotate: -45, x: -100, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, x: 0, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: i * 0.1,
            }}
            className="relative"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-700 font-extrabold text-white shadow-lg"
              style={{
                boxShadow:
                  "0 0 30px rgba(220, 38, 38, 0.8), 0 0 60px rgba(220, 38, 38, 0.4)",
                transform: "rotate(-5deg)",
              }}
            >
              <span className="text-5xl">X</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/ui/strike-display.tsx
git commit -m "feat: add strike display with animated X elements"
```

---

## Task 8: Create Phase Transition Overlay Component

**Files:**
- Create: `components/ui/phase-transition-overlay.tsx`

**Step 1: Create overlay for steal phase transition**

Create `components/ui/phase-transition-overlay.tsx`:

```typescript
"use client";

import { motion, AnimatePresence } from "framer-motion";

interface PhaseTransitionOverlayProps {
  show: boolean;
  message: string;
  teamColor?: string;
}

export function PhaseTransitionOverlay({
  show,
  message,
  teamColor = "#ef4444",
}: PhaseTransitionOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            className="relative text-center"
            initial={{ scale: 0.5, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.5, y: -50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div
              className="text-6xl font-extrabold uppercase tracking-wider text-white md:text-8xl"
              style={{
                textShadow: `0 0 40px ${teamColor}cc, 0 0 80px ${teamColor}66, 5px 5px 0 rgba(0,0,0,0.5)`,
                WebkitTextStroke: "3px rgba(0,0,0,0.3)",
              }}
            >
              {message}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Commit**

```bash
git add components/ui/phase-transition-overlay.tsx
git commit -m "feat: add phase transition overlay component"
```

---

## Task 9: Integrate Components into GameBoard - Part 1 (Header & Round Pot)

**Files:**
- Modify: `components/game-board.tsx`

**Step 1: Add imports at top of game-board.tsx**

At the top of `components/game-board.tsx`, add these imports after existing ones:

```typescript
import { FamilyFeudHeader } from "./ui/family-feud-header";
import { RoundPotDisplay } from "./ui/round-pot-display";
import { SurveySaysOverlay } from "./ui/survey-says-overlay";
import { AnswerCard } from "./ui/answer-card";
import { StrikeDisplay } from "./ui/strike-display";
import { PhaseTransitionOverlay } from "./ui/phase-transition-overlay";
import { useSurveySaysTTS } from "@/hooks/use-survey-says-tts";
```

**Step 2: Add Survey Says state and hook in GameBoard component**

Inside the `GameBoard` component function, after the existing hooks, add:

```typescript
const [showSurveySays, setShowSurveySays] = useState(false);
const [showStealTransition, setShowStealTransition] = useState(false);
const surveySaysTTS = useSurveySaysTTS();
```

**Step 3: Pre-cache Survey Says audio on mount**

Add this useEffect after the existing useEffects:

```typescript
useEffect(() => {
  if (voiceEnabled) {
    surveySaysTTS.preCache();
  }
  return () => surveySaysTTS.cleanup();
}, [voiceEnabled, surveySaysTTS]);
```

**Step 4: Replace header section**

Find the header section (around line 85-104) and replace with:

```typescript
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
```

**Step 5: Commit**

```bash
git add components/game-board.tsx
git commit -m "feat: integrate header and round pot display"
```

---

## Task 10: Integrate Components into GameBoard - Part 2 (Answer Cards & Strikes)

**Files:**
- Modify: `components/game-board.tsx`

**Step 1: Replace answer board grid**

Find the answer board grid section (around line 128-138) and replace with:

```typescript
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
```

**Step 2: Replace strike counter**

Find the strikes section (around line 140-143) and replace with:

```typescript
{/* Strikes */}
<StrikeDisplay strikes={round.strikes} />
```

**Step 3: Remove old AnswerCard and StrikeCounter component definitions**

Delete the `AnswerCard` component (around line 229-252) and the `StrikeCounter` component (around line 254-257) from the bottom of the file since we're using the new extracted components.

**Step 4: Commit**

```bash
git add components/game-board.tsx
git commit -m "feat: integrate answer cards and strike display components"
```

---

## Task 11: Integrate Survey Says Flow

**Files:**
- Modify: `components/game-board.tsx`

**Step 1: Update onSubmit function to include Survey Says moment**

Find the `onSubmit` function (around line 52) and replace it with:

```typescript
const onSubmit = async () => {
  if (!answer.trim() || submitting) return;
  setSubmitting(true);

  // Show Survey Says overlay
  setShowSurveySays(true);

  // Play Survey Says TTS
  await surveySaysTTS.play();

  // Brief pause for dramatic effect
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Hide overlay
  setShowSurveySays(false);

  // Process answer
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
```

**Step 2: Add Survey Says overlay to render**

After the closing `</div>` of the main game board (before the final closing div), add:

```typescript
{/* Survey Says Overlay */}
<SurveySaysOverlay show={showSurveySays} />
```

**Step 3: Commit**

```bash
git add components/game-board.tsx
git commit -m "feat: integrate Survey Says moment into answer submission flow"
```

---

## Task 12: Add Steal Phase Transition

**Files:**
- Modify: `components/game-board.tsx`

**Step 1: Add useEffect to detect steal phase transition**

Add this useEffect after the existing ones in GameBoard:

```typescript
useEffect(() => {
  if (phase === "steal" && !showStealTransition) {
    setShowStealTransition(true);
    const timer = setTimeout(() => {
      setShowStealTransition(false);
    }, 1500);
    return () => clearTimeout(timer);
  }
}, [phase, showStealTransition]);
```

**Step 2: Add steal transition overlay to render**

After the Survey Says overlay, add:

```typescript
{/* Steal Phase Transition */}
<PhaseTransitionOverlay
  show={showStealTransition}
  message="STEAL TIME!"
  teamColor={teams[activeTeamIndex].color}
/>
```

**Step 3: Reset showStealTransition on new question**

In the existing useEffect that runs when currentQuestion changes (around line 32), add:

```typescript
setShowStealTransition(false);
```

**Step 4: Commit**

```bash
git add components/game-board.tsx
git commit -m "feat: add steal phase transition overlay"
```

---

## Task 13: Enhance Score Cards with LED Glow

**Files:**
- Modify: `components/game-board.tsx`

**Step 1: Update ScoreCard component styling**

Find the `ScoreCard` component (around line 203) and replace with:

```typescript
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
      className={`rounded-md px-3 py-2 text-white transition-all duration-300 ${
        active
          ? "ring-2 ring-white/90 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          : "ring-0 opacity-80"
      } ${bump ? "scale-105" : "scale-100"}`}
      style={{
        background: color,
        boxShadow: active
          ? `0 0 20px ${color}66, 0 0 40px ${color}33, inset 0 1px 0 rgba(255,255,255,0.2)`
          : undefined
      }}
    >
      <div className="text-[10px] leading-none opacity-85">{label.toUpperCase()}</div>
      <div className="text-lg font-bold leading-tight tabular-nums">{score}</div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/game-board.tsx
git commit -m "feat: enhance score cards with LED glow effect"
```

---

## Task 14: Add Question Entrance Animation

**Files:**
- Modify: `components/game-board.tsx`

**Step 1: Wrap answer grid in motion.div with stagger**

Replace the answer grid section with:

```typescript
{/* Board: condensed two-column layout */}
<motion.div
  className="grid grid-cols-2 gap-3"
  initial="hidden"
  animate="visible"
  variants={{
    visible: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  }}
>
  {currentQuestion.answers.map((a, idx) => (
    <motion.div
      key={idx}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
    >
      <AnswerCard
        revealed={round.revealed[idx]}
        text={a.text}
        points={a.points}
        index={idx}
      />
    </motion.div>
  ))}
</motion.div>
```

**Step 2: Add motion import if not already present**

Verify `motion` is imported from framer-motion at the top.

**Step 3: Commit**

```bash
git add components/game-board.tsx
git commit -m "feat: add staggered entrance animation for answer cards"
```

---

## Task 15: Add Reduced Motion Support

**Files:**
- Modify: `components/ui/answer-card.tsx`
- Modify: `components/ui/strike-display.tsx`
- Modify: `components/ui/survey-says-overlay.tsx`
- Modify: `components/ui/phase-transition-overlay.tsx`

**Step 1: Add reduced motion hook**

Create `hooks/use-reduced-motion.ts`:

```typescript
import { useEffect, useState } from "react";

export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  return prefersReducedMotion;
}
```

**Step 2: Update AnswerCard to respect reduced motion**

In `components/ui/answer-card.tsx`, add at top:

```typescript
import { useReducedMotion } from "@/hooks/use-reduced-motion";
```

Then inside component:

```typescript
const prefersReducedMotion = useReducedMotion();
```

And modify the cardVariants:

```typescript
const cardVariants = {
  hidden: {
    rotateY: 0,
  },
  revealed: {
    rotateY: prefersReducedMotion ? 0 : 360,
    transition: {
      duration: prefersReducedMotion ? 0 : 0.6,
      ease: "easeInOut",
    },
  },
};
```

**Step 3: Update other components similarly**

Apply the same pattern to `strike-display.tsx`, `survey-says-overlay.tsx`, and `phase-transition-overlay.tsx` - reducing animation duration to 0 or minimal values when `prefersReducedMotion` is true.

**Step 4: Commit**

```bash
git add hooks/use-reduced-motion.ts components/ui/answer-card.tsx components/ui/strike-display.tsx components/ui/survey-says-overlay.tsx components/ui/phase-transition-overlay.tsx
git commit -m "feat: add reduced motion accessibility support"
```

---

## Task 16: Update Home Screen with New Header

**Files:**
- Modify: `components/home-screen.tsx`

**Step 1: Add header to home screen**

Read `components/home-screen.tsx` to find current structure, then add `FamilyFeudHeader` import and component at the top of the rendered content.

Expected: Home screen now shows Family Feud logo consistently with game board.

**Step 2: Commit**

```bash
git add components/home-screen.tsx
git commit -m "feat: add Family Feud header to home screen"
```

---

## Task 17: Performance Optimization - Add will-change CSS

**Files:**
- Modify: `app/globals.css`

**Step 1: Add performance utilities to globals.css**

Add after existing styles:

```css
/* Performance optimizations for animations */
.will-change-transform {
  will-change: transform;
}

.will-change-opacity {
  will-change: opacity;
}

.gpu-accelerate {
  transform: translateZ(0);
  backface-visibility: hidden;
}
```

**Step 2: Apply to animated components**

Add `will-change-transform` class to motion.div elements in answer-card.tsx, strike-display.tsx, and overlays.

**Step 3: Commit**

```bash
git add app/globals.css components/ui/answer-card.tsx components/ui/strike-display.tsx
git commit -m "perf: add will-change and GPU acceleration to animated elements"
```

---

## Task 18: Testing & Verification

**Files:**
- Test: Manual testing across all game phases

**Step 1: Start development server**

```bash
pnpm dev
```

Expected: Server starts on http://localhost:3000

**Step 2: Test complete game flow**

1. Start new game with team names
2. Submit answers and verify:
   - Survey Says overlay appears
   - TTS plays (if voice enabled)
   - Answer flips with animation
   - Points counter animates
   - Round pot updates
3. Get 3 strikes and verify:
   - X animations appear one by one
   - "STEAL TIME!" overlay shows
   - Team switches correctly
4. Complete steal phase
5. Advance to next question and verify entrance animations
6. Complete game and check results screen

Expected: All animations smooth, no console errors, game logic intact

**Step 3: Test reduced motion**

Enable "Reduce motion" in OS accessibility settings, reload page, verify animations are minimal/instant.

Expected: Animations respect user preference

**Step 4: Test mobile responsiveness**

Resize browser to mobile width, verify:
- Logo scales appropriately
- Round pot display readable
- Strike Xs don't overflow
- Overlays centered properly

Expected: All components responsive and readable

**Step 5: Performance check**

Open browser DevTools → Performance tab, record gameplay session, verify:
- Frame rate stays at ~60fps
- No long tasks blocking main thread
- No layout thrashing

Expected: Smooth 60fps performance

---

## Task 19: Documentation Update

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md with new components**

Add section documenting new components and hooks:

```markdown
### New UI Components (Family Feud Enhancement)

**Animation Components** (`components/ui/`):
- `family-feud-header.tsx`: Official logo display with glow effect
- `round-pot-display.tsx`: Animated point accumulator
- `survey-says-overlay.tsx`: "Survey Says!" moment with TTS
- `answer-card.tsx`: LED-style cards with flip animation
- `strike-display.tsx`: Animated big red X system
- `phase-transition-overlay.tsx`: Steal/end game transitions

**New Hooks**:
- `use-number-counter.ts`: Animated number transitions
- `use-survey-says-tts.ts`: Pre-cached "Survey Says!" TTS
- `use-reduced-motion.ts`: Accessibility support

**Performance**: All animations use GPU-accelerated transforms/opacity. Respects `prefers-reduced-motion`.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document new Family Feud enhancement components"
```

---

## Task 20: Final Build & Lint

**Files:**
- Test: Production build

**Step 1: Run linter**

```bash
pnpm lint
```

Expected: No errors (or fix any that appear)

**Step 2: Run production build**

```bash
pnpm build
```

Expected: Build succeeds, no type errors

**Step 3: Test production build**

```bash
pnpm start
```

Navigate to http://localhost:3000 and verify game works in production mode.

Expected: All features functional in production

**Step 4: Final commit if needed**

```bash
git add .
git commit -m "chore: fix lint/build issues"
```

---

## Completion Checklist

- [ ] All components created and integrated
- [ ] Survey Says TTS works and caches properly
- [ ] Answer flip animations smooth and synchronized
- [ ] Strike X animations dramatic and timed correctly
- [ ] Round pot displays and animates
- [ ] Score cards have LED glow effect
- [ ] Phase transitions work (steal, game end)
- [ ] Family Feud logo displays on all screens
- [ ] Reduced motion preference respected
- [ ] Performance at 60fps
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Production build succeeds
- [ ] Documentation updated

---

## Future Enhancements (Out of Scope)

These were discussed but user will source assets later:
- All-revealed celebration sound effect
- Victory/defeat sounds
- Additional particle effects for celebrations
- Theme music integration during non-gameplay moments
- Custom sound effects for specific moments

---

**End of Plan**
