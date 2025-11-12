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
