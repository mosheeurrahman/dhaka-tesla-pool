import Link from "next/link";

const STATUS_STYLE = {
  open: "text-marigold",
  accepted: "text-dusk-teal",
  driver_arrived: "text-dusk-teal",
  started: "text-rickshaw-green",
  completed: "text-rickshaw-green",
  cancelled: "text-ink/40",
};

export default function PoolCard({ pool, memberCount }) {
  return (
    <Link
      href={`/driver/pools/${pool.id}`}
      className={`block border-2 rounded-2xl p-4 mb-3 transition-transform hover:-translate-y-0.5 ${
        pool.status === "cancelled" ? "border-ink/10 opacity-60" : "border-rickshaw-green/20"
      }`}
    >
      <div className="flex justify-between items-center">
        <div>
          <p className="font-display font-semibold text-ink">
            {memberCount} passenger{memberCount !== 1 ? "s" : ""}
          </p>
          <p className="text-sm text-ink/60">
            {new Date(pool.created_at).toLocaleDateString()}
          </p>
        </div>
        <span className={`text-sm font-semibold capitalize ${STATUS_STYLE[pool.status]}`}>
          {pool.status.replace("_", " ")}
        </span>
      </div>
    </Link>
  );
}