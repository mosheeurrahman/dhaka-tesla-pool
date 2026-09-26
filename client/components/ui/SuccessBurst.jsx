"use client";

import { motion, useReducedMotion } from "framer-motion";
import Flower from "../motifs/Flower";

const OFFSETS = [
  { x: -40, y: -30, color: "var(--color-rickshaw-red)" },
  { x: 40, y: -30, color: "var(--color-marigold)" },
  { x: -30, y: 30, color: "var(--color-dusk-teal)" },
  { x: 30, y: 30, color: "var(--color-rickshaw-green)" },
];

export default function SuccessBurst() {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return null;

  return (
    <div className="relative w-0 h-0 mx-auto">
      {OFFSETS.map((o, i) => (
        <motion.div
          key={i}
          className="absolute w-6 h-6"
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.3 }}
          animate={{ x: o.x, y: o.y, opacity: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: i * 0.05, ease: "easeOut" }}
        >
          <Flower className="w-full h-full" color={o.color} />
        </motion.div>
      ))}
    </div>
  );
}