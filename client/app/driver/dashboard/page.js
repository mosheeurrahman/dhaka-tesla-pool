"use client";

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import Nav from "@/components/layout/Nav";
import Button from "@/components/ui/Button";

export default function DriverDashboard() {
  const { user, loading } = useRequireAuth("driver");
  const { logout } = useAuth();

  if (loading || !user) return null;

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-2xl mx-auto px-6 py-12 text-center">
        <h1 className="font-display text-3xl font-bold text-rickshaw-red mb-2">
          Welcome, {user.full_name}
        </h1>
        <p className="text-ink/70 mb-8">Bullet's control panel lands here next.</p>
        <Button variant="secondary" onClick={logout}>
          Log out
        </Button>
      </section>
    </main>
  );
}