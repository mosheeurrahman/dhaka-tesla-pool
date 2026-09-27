import { formatPaisa } from "@/lib/rideStatus";

export default function PathLegendCard({ label, color, pathNames, distanceKm, farePaisa }) {
  return (
    <div className="border-2 rounded-xl p-3" style={{ borderColor: color }}>
      <p className="font-display font-semibold" style={{ color }}>
        {label}
      </p>
      <p className="text-sm text-ink/70 mt-1">Path: {pathNames.join(" → ")}</p>
      {distanceKm != null && <p className="text-xs text-ink/50 mt-1">Distance: {distanceKm} km</p>}
      {farePaisa != null && (
        <p className="text-sm font-semibold text-rickshaw-red mt-1">{formatPaisa(farePaisa)}</p>
      )}
    </div>
  );
}