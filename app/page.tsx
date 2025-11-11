"use client";

import { useEffect, useState } from "react";
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
