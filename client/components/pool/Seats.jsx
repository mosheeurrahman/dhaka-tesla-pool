export default function Seats({ capacity, members }) {
  const activeMembers = members.filter((m) => m.status === "active");
  const seatSlots = Array.from({ length: capacity }, (_, i) => activeMembers[i] || null);

  return (
    <div className="flex justify-center gap-3 my-4">
      {seatSlots.map((member, i) => (
        <div
          key={i}
          className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-display font-semibold text-sm border-2 ${
            member
              ? "bg-rickshaw-green text-cream border-rickshaw-green"
              : "border-dashed border-ink/20 text-ink/30"
          }`}
        >
          {member ? (
            <>
              <span className="text-xs">{member.passenger_name.split(" ")[0]}</span>
              <span className="text-[10px] opacity-80">{member.seats_allocated} seat</span>
            </>
          ) : (
            <span>Empty</span>
          )}
        </div>
      ))}
      <p className="sr-only">
        {activeMembers.length} / {capacity} seats filled
      </p>
    </div>
  );
}