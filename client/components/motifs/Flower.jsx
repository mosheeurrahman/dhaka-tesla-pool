export default function Flower({ className = "", color = "currentColor" }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <g fill={color}>
        <circle cx="20" cy="12" r="6" />
        <circle cx="28" cy="20" r="6" />
        <circle cx="20" cy="28" r="6" />
        <circle cx="12" cy="20" r="6" />
      </g>
      <circle cx="20" cy="20" r="5" fill="var(--color-marigold)" />
    </svg>
  );
}