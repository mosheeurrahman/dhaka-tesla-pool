export default function Input({ label, error, className = "", ...props }) {
  return (
    <label className="block text-left">
      {label && (
        <span className="font-body text-sm font-medium text-ink/80 mb-1 block">{label}</span>
      )}
      <input
        className={`w-full bg-cream border-2 rounded-xl px-4 py-3 font-body text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-marigold transition-colors ${
          error ? "border-rickshaw-red" : "border-rickshaw-green/30 focus:border-rickshaw-green"
        } ${className}`}
        {...props}
      />
      {error && <span className="text-rickshaw-red text-sm mt-1 block">{error}</span>}
    </label>
  );
}