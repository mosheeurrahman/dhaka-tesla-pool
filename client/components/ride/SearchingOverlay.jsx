"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RockingBullet from "../motifs/RockingBullet";

const STAGES = [
  "Looking for a Tesla...",
  "Finding a seat...",
  "Matching your route...",
  "Tesla found!",
];

export default function SearchingOverlay({ onDone, totalDurationMs = 2400 }) {
  const [stageIndex, setStageIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const stageDuration = totalDurationMs / STAGES.length;

  useEffect(() => {
    if (stageIndex >= STAGES.length - 1) {
      const finishTimer = setTimeout(onDone, stageDuration);
      return () => clearTimeout(finishTimer);
    }
    const timer = setTimeout(() => setStageIndex((i) => i + 1), stageDuration);
    return () => clearTimeout(timer);
  }, [stageIndex, stageDuration, onDone]);

  return (
    <div className="fixed inset-0 bg-cream/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-6">
      <RockingBullet className="w-32 h-32" />

      <AnimatePresence mode="wait">
        <motion.p
          key={stageIndex}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? {} : { opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="font-display text-xl font-semibold text-rickshaw-green"
        >
          {STAGES[stageIndex]}
        </motion.p>
      </AnimatePresence>

      <div className="flex gap-2">
        {STAGES.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i <= stageIndex ? "bg-marigold" : "bg-ink/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}