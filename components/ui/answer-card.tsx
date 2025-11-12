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

export function AnswerCard({ revealed, text, points }: AnswerCardProps) {
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
        ease: [0.42, 0, 0.58, 1] as const,
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
