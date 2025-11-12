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
