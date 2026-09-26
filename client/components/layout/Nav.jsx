"use client";

import Image from "next/image";
import Link from "next/link";
import Wheel from "../motifs/Wheel";
import { useAuth } from "@/context/AuthContext";

export default function Nav() {
  const { user, logout } = useAuth();

  return (
    <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/logo.png" alt="Dhaka Tesla Pool" width={40} height={40} className="rounded-full" />
        <span className="font-display font-bold text-lg text-rickshaw-green hidden sm:inline">
          Dhaka Tesla Pool
        </span>
      </Link>

      <div className="flex items-center gap-6">
        {user ? (
          <>
            <span className="font-body text-ink/70 hidden sm:inline">Hi, {user.full_name}</span>
            <button
              onClick={logout}
              className="btn-press bg-rickshaw-green text-cream px-4 py-2 rounded-full font-display font-semibold"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="font-body text-ink hover:text-rickshaw-green transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="btn-press flex items-center gap-2 bg-rickshaw-green text-cream px-4 py-2 rounded-full font-display font-semibold"
            >
              <Wheel className="w-4 h-4" color="var(--color-cream)" />
              Get a Tesla
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}