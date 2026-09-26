"use client";

import { motion, useReducedMotion } from "framer-motion";
import BulletIcon from "./BulletIcon";

export default function RockingBullet({ className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      animate={shouldReduceMotion ? {} : { rotate: [-2, 2, -2] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <BulletIcon className="w-full h-full" />
    </motion.div>
  );
}