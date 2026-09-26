export default function Wheel({ className = "", color = "currentColor" }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="2.5" />
      <circle cx="20" cy="20" r="4" fill="var(--color-marigold)" />
      {[0, 60, 120].map((deg) => (
        <line
          key={deg}
          x1="20"
          y1="20"
          x2={20 + 17 * Math.cos((deg * Math.PI) / 180)}
          y2={20 + 17 * Math.sin((deg * Math.PI) / 180)}
          stroke={color}
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}