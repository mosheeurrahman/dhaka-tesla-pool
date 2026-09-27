"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Wheel from "../motifs/Wheel";
import { useAuth } from "@/context/AuthContext";

export default function Nav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isDriverSection = pathname?.startsWith("/driver");
  const isSignupPage = pathname === "/signup" || pathname === "/driver/signup";

  return (
    <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto gap-4">
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <Image src="/logo.png" alt="Dhaka Tesla Pool" width={40} height={40} className="rounded-full" />
        <span className="font-display font-bold text-lg text-rickshaw-green hidden sm:inline">
          Dhaka Tesla Pool
        </span>
      </Link>

      <div className="flex items-center gap-4">
        {!user && (
          <div className="flex items-center bg-cream-dark/50 rounded-full p-1 border-2 border-ink/10">
            <Link
              href="/login"
              className={`px-4 py-1.5 rounded-full text-sm font-display font-semibold transition-colors ${
                !isDriverSection ? "bg-rickshaw-green text-cream" : "text-ink/60 hover:text-rickshaw-green"
              }`}
            >
              Passenger
            </Link>
            <Link
              href="/driver/login"
              className={`px-4 py-1.5 rounded-full text-sm font-display font-semibold transition-colors ${
                isDriverSection ? "bg-rickshaw-red text-cream" : "text-ink/60 hover:text-rickshaw-red"
              }`}
            >
              Driver
            </Link>
          </div>
        )}

        {user ? (
          <>
            <Link
              href={user.role === "driver" ? "/driver/dashboard" : "/dashboard"}
              className="font-body text-ink hover:text-rickshaw-green transition-colors hidden sm:inline"
            >
              Dashboard
            </Link>
            <span className="font-body text-ink/70 hidden md:inline">Hi, {user.full_name}</span>
            <button
              onClick={logout}
              className="btn-press bg-rickshaw-green text-cream px-4 py-2 rounded-full font-display font-semibold"
            >
              Log out
            </button>
          </>
        ) : (
          !isSignupPage && (
            <Link
              href={isDriverSection ? "/driver/signup" : "/signup"}
              className="btn-press flex items-center gap-2 bg-rickshaw-red text-cream px-4 py-2 rounded-full font-display font-semibold whitespace-nowrap"
            >
              <Wheel className="w-4 h-4" color="var(--color-cream)" />
              Get a Tesla
            </Link>
          )
        )}
      </div>
    </nav>
  );
}