const VARIANTS = {
  primary: "bg-rickshaw-red text-cream hover:bg-rickshaw-red-dark",
  secondary: "bg-rickshaw-green text-cream hover:bg-rickshaw-green-dark",
  outline: "bg-transparent text-rickshaw-green border-2 border-rickshaw-green hover:bg-rickshaw-green hover:text-cream",
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button
      className={`btn-press px-6 py-3 rounded-full font-display font-semibold text-base shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-marigold ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}