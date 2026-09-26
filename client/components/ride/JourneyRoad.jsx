import BulletIcon from "../motifs/BulletIcon";
import { RIDE_STATUS_PROGRESS } from "@/lib/rideStatus";

export default function JourneyRoad({ pickupName, destinationName, status }) {
  const progress = RIDE_STATUS_PROGRESS[status] ?? 0;
  const muted = status === "cancelled";

  return (
    <div className="w-full py-4">
      <div className="flex justify-between font-display font-semibold text-rickshaw-green mb-3">
        <span>{pickupName || "..."}</span>
        <span>{destinationName || "..."}</span>
      </div>
      <div className="relative h-3 bg-cream-dark rounded-full border-2 border-rickshaw-green/20">
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${
            muted ? "bg-ink/20" : "bg-marigold"
          }`}
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute -top-4 transition-all duration-700"
          style={{ left: `calc(${progress}% - 20px)` }}
        >
          <BulletIcon className={`w-10 h-10 ${muted ? "opacity-40 grayscale" : ""}`} />
        </div>
      </div>
    </div>
  );
}