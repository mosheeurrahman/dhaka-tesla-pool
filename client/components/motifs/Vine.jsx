export default function Vine({ className = "", color = "currentColor" }) {
  return (
    <svg viewBox="0 0 200 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M2 12 Q 30 2, 50 12 T 100 12 T 150 12 T 198 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="50" cy="12" r="3" fill="var(--color-rickshaw-red)" />
      <circle cx="100" cy="12" r="3" fill="var(--color-marigold)" />
      <circle cx="150" cy="12" r="3" fill="var(--color-dusk-teal)" />
    </svg>
  );
}