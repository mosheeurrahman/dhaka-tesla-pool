const PALETTE = [
  "var(--color-rickshaw-green)",
  "var(--color-rickshaw-red)",
  "var(--color-marigold)",
  "var(--color-dusk-teal)",
];

function colorForName(name) {
  const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

export default function Avatar({ name, size = "md" }) {
  const initial = name?.[0]?.toUpperCase() || "?";
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-12 h-12 text-base";

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-display font-bold text-cream shrink-0`}
      style={{ backgroundColor: colorForName(name || "?") }}
      title={name}
    >
      {initial}
    </div>
  );
}