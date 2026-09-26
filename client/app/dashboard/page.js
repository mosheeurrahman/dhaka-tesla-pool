"use client";

import Link from "next/link";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import Nav from "@/components/layout/Nav";

export default function PassengerDashboard() {
  const { user, loading } = useRequireAuth("passenger");
  if (loading || !user) return null;

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-rickshaw-green mb-8">
          Welcome, {user.full_name}
        </h1>
        <div className="flex flex-col gap-4">
          <Link
            href="/request"
            className="btn-press bg-rickshaw-red text-cream font-display font-semibold text-lg rounded-full py-4"
          >
            Find My Tesla
          </Link>
          <Link
            href="/history"
            className="btn-press border-2 border-rickshaw-green text-rickshaw-green font-display font-semibold text-lg rounded-full py-4"
          >
            Your Journeys
          </Link>
        </div>
      </section>
    </main>
  );
}