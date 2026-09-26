"use client";

import { motion, useReducedMotion } from "framer-motion";
import BulletIcon from "../motifs/BulletIcon";
import { RIDE_STATUS_PROGRESS } from "@/lib/rideStatus";

export default function JourneyRoad({ pickupName, destinationName, status }) {
  const progress = RIDE_STATUS_PROGRESS[status] ?? 0;
  const muted = status === "cancelled";
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="w-full py-4">
      <div className="flex justify-between font-display font-semibold text-rickshaw-green mb-3">
        <span>{pickupName || "..."}</span>
        <span>{destinationName || "..."}</span>
      </div>
      <div className="relative h-3 bg-cream-dark rounded-full border-2 border-rickshaw-green/20">
        <motion.div
          className={`absolute top-0 left-0 h-full rounded-full ${muted ? "bg-ink/20" : "bg-marigold"}`}
          animate={{ width: `${progress}%` }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 16 }}
        />
        <motion.div
          className="absolute -top-4"
          animate={{ left: `calc(${progress}% - 20px)` }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 16 }}
        >
          <BulletIcon className={`w-10 h-10 ${muted ? "opacity-40 grayscale" : ""}`} />
        </motion.div>
      </div>
    </div>
  );
}