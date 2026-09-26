import Link from "next/link";
import { formatPaisa } from "@/lib/rideStatus";

const STATUS_STYLE = {
  requested: "text-marigold",
  matched: "text-dusk-teal",
  accepted: "text-dusk-teal",
  driver_arrived: "text-dusk-teal",
  started: "text-rickshaw-green",
  completed: "text-rickshaw-green",
  cancelled: "text-ink/40",
};

export default function RideCard({ ride, pickupName, destinationName }) {
  const isCancelled = ride.status === "cancelled";
  return (
    <Link
      href={`/ride/${ride.id}`}
      className={`block border-2 rounded-2xl p-4 mb-3 transition-transform hover:-translate-y-0.5 ${
        isCancelled ? "border-ink/10 opacity-60" : "border-rickshaw-green/20"
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-display font-semibold text-ink">
            {pickupName} → {destinationName}
          </p>
          <p className="text-sm text-ink/60 mt-1">
            {new Date(ride.requested_at).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display font-bold text-lg text-rickshaw-red">
            {formatPaisa(ride.final_fare_paisa ?? ride.estimated_fare_paisa)}
          </p>
          <p className={`text-sm font-semibold capitalize ${STATUS_STYLE[ride.status]}`}>
            {ride.status.replace("_", " ")}
          </p>
        </div>
      </div>
    </Link>
  );
}