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
