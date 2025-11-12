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
