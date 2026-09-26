import Avatar from "../ui/Avatar";

export default function Seats({ capacity, members }) {
  const activeMembers = members.filter((m) => m.status === "active");
  const seatSlots = Array.from({ length: capacity }, (_, i) => activeMembers[i] || null);

  return (
    <div>
      <div className="flex justify-center gap-3 my-4">
        {seatSlots.map((member, i) => (
          <div
            key={i}
            className={`w-20 h-24 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 ${
              member
                ? "bg-cream-dark/60 border-rickshaw-green"
                : "border-dashed border-ink/20 text-ink/30"
            }`}
          >
            {member ? (
              <>
                <Avatar name={member.passenger_name} size="sm" />
                <span className="text-[10px] font-body text-ink/70">
                  {member.passenger_name.split(" ")[0]}
                </span>
                <span className="text-[9px] text-ink/40">{member.seats_allocated} seat</span>
              </>
            ) : (
              <span className="text-xs">Empty</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-ink/60">
        {activeMembers.length} / {capacity} seats filled
      </p>
    </div>
  );
}