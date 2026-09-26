export default function BulletIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true">
      <path
        d="M8 26 Q8 12 22 12 L38 12 Q48 12 48 22 L48 26"
        fill="none"
        stroke="var(--color-rickshaw-green)"
        strokeWidth="3"
      />
      <rect x="6" y="22" width="44" height="10" rx="3" fill="var(--color-rickshaw-green)" />
      <rect x="14" y="14" width="16" height="9" rx="2" fill="var(--color-rickshaw-red)" />
      <circle cx="16" cy="34" r="5" fill="var(--color-ink)" />
      <circle cx="42" cy="34" r="5" fill="var(--color-ink)" />
      <circle cx="16" cy="34" r="2" fill="var(--color-marigold)" />
      <circle cx="42" cy="34" r="2" fill="var(--color-marigold)" />
    </svg>
  );
}