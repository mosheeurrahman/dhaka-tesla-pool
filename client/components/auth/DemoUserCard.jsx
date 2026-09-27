export default function DemoUserCard({ user, onSelect, accent = "green" }) {
  const borderColor = accent === "red" ? "border-rickshaw-red/40 hover:border-rickshaw-red" : "border-rickshaw-green/40 hover:border-rickshaw-green";

  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      className={`btn-press w-full text-center border-2 ${borderColor} rounded-xl px-2 py-3 bg-cream-dark/30 transition-colors`}
    >
      <p className="font-display font-semibold text-ink text-sm truncate">{user.name}</p>
      <p className="text-[10px] text-ink/50 font-body mt-1">tap to fill</p>
    </button>
  );
}