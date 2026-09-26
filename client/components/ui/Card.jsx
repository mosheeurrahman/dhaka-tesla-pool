import Flower from "../motifs/Flower";

export default function Card({ children, accent = "green", className = "", showMotif = false }) {
  const borderColor = accent === "red" ? "border-rickshaw-red" : "border-rickshaw-green";

  return (
    <div
      className={`relative bg-cream-dark/40 border-2 ${borderColor} rounded-2xl p-5 ${className}`}
    >
      {showMotif && (
        <Flower className="absolute -top-3 -right-3 w-7 h-7 opacity-90" />
      )}
      {children}
    </div>
  );
}