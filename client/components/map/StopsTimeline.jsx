"use client";

function groupEvents(events) {
  const groups = [];
  events.forEach((e, i) => {
    const last = groups[groups.length - 1];
    if (last && last.pos === e.pos) {
      last.items.push({ ...e, index: i });
    } else {
      groups.push({ pos: e.pos, code: e.code, items: [{ ...e, index: i }] });
    }
  });
  return groups;
}

export default function StopsTimeline({ graph, events, currentStopIndex, active }) {
  const nameByCode = Object.fromEntries((graph?.nodes || []).map((n) => [n.code, n.name]));
  const groups = groupEvents(events);
  const nextGroupIdx = active
    ? groups.findIndex((g) => !g.items.every((it) => it.index < currentStopIndex))
    : -1;

  return (
    <ol className="mt-4 space-y-2">
      {groups.map((g, gi) => {
        const done = g.items.every((it) => it.index < currentStopIndex);
        const isNext = active && gi === nextGroupIdx;
        return (
          <li
            key={`${g.code}-${gi}`}
            className={`flex items-start gap-3 rounded-xl border-2 px-3 py-2 transition-colors ${
              done
                ? "border-rickshaw-green/30 bg-cream-dark/30"
                : isNext
                ? "border-marigold bg-marigold/10"
                : "border-ink/10"
            }`}
          >
            <span
              className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                done
                  ? "bg-rickshaw-green text-cream"
                  : isNext
                  ? "bg-marigold text-ink"
                  : "border-2 border-ink/20 text-ink/40"
              }`}
            >
              {done ? "✓" : gi + 1}
            </span>
            <div>
              <p className="font-display font-semibold text-ink">{nameByCode[g.code] || g.code}</p>
              <p className="text-xs text-ink/60">
                {g.items
                  .map((it) => `${it.passenger_name} ${it.type === "pickup" ? "pickup" : "drop-off"}`)
                  .join(" · ")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}