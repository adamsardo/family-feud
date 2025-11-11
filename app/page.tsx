"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { GameProvider, useGame } from "@/components/game-context";
import { HomeScreen } from "@/components/home-screen";
import { GameBoard } from "@/components/game-board";
import { ResultsScreen } from "@/components/results-screen";

function Content() {
  const { phase } = useGame();
  if (phase === "setup") return <HomeScreen />;
  if (phase === "results") return <ResultsScreen />;
  return <GameBoard />;
}

function ThemeMusic({ play }: { play: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (unlocked) return;
    const unlock = () => setUnlocked(true);
    const events: Array<keyof DocumentEventMap> = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, unlock, { once: true });
    });
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, unlock);
      });
    };
  }, [unlocked]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/Family%20Feud%20Theme%20Song.mp3");
      audioRef.current.loop = true;
      audioRef.current.volume = 0.35;
      audioRef.current.preload = "auto";
    }
    const audio = audioRef.current;
    if (play) {
      audio.play().catch(() => {
        // playback will retry after user interaction unlocks audio
      });
    } else {
      audio.pause();
    }
  }, [play]);

  useEffect(() => {
    if (!play || !unlocked || !audioRef.current) return;
    audioRef.current.play().catch(() => {});
  }, [play, unlocked]);

  return null;
}

function PhaseAwareThemeMusic({ showSplash }: { showSplash: boolean }) {
  const { phase } = useGame();
  const play = showSplash || phase === "setup";
  return <ThemeMusic play={play} />;
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const dismiss = () => setShowSplash(false);
  useEffect(() => {
    if (!showSplash) return;
    const { style } = document.documentElement;
    const prevOverflow = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = prevOverflow;
    };
  }, [showSplash]);

  return (
    <GameProvider>
      <PhaseAwareThemeMusic showSplash={showSplash} />
      {showSplash && (
        <div
          className="fixed inset-0 z-50 cursor-pointer select-none touch-none overscroll-none outline-none"
          onClick={dismiss}
          onPointerDown={dismiss}
          onTouchStart={dismiss}
          onKeyDown={dismiss}
          role="button"
          tabIndex={0}
          aria-label="Dismiss splash screen"
          aria-modal="true"
        >
          <Image
            src="/Generated Image November 12, 2025 - 6_35AM.png"
            alt="Splash"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
            draggable={false}
          />
        </div>
      )}
      <Content />
    </GameProvider>
  );
}
