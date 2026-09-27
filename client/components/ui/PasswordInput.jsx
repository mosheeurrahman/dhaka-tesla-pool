"use client";

import { useState } from "react";

function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.36 5.11A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-3.17 3.89M6.6 6.6C4.14 8.3 2 12 2 12a13.2 13.2 0 0 0 5.06 5.29"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PasswordInput({ label, error, className = "", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block text-left">
      {label && (
        <span className="font-body text-sm font-medium text-ink/80 mb-1 block">{label}</span>
      )}
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          className={`w-full bg-cream border-2 rounded-xl pl-4 pr-12 py-3 font-body text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-marigold transition-colors ${
            error ? "border-rickshaw-red" : "border-rickshaw-green/30 focus:border-rickshaw-green"
          } ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-rickshaw-green transition-colors"
        >
          {visible ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
        </button>
      </div>
      {error && <span className="text-rickshaw-red text-sm mt-1 block">{error}</span>}
    </label>
  );
}