"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Nav from "@/components/layout/Nav";
import PoolCard from "@/components/pool/PoolCard";

export default function DriverHistory() {
  const { user, loading } = useRequireAuth("driver");
  const { token } = useAuth();
  const [pools, setPools] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (!token) return;
    api.getMyPoolsDetailed(token, statusFilter || undefined).then(({ data }) => setPools(data.pools));
  }, [token, statusFilter]);

  if (loading || !user) return null;

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-bold text-rickshaw-green mb-6 text-center">
          Bullet's trips
        </h1>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="mb-6 bg-cream border-2 border-rickshaw-green/30 rounded-xl px-4 py-2 font-body"
        >
          <option value="">All pools</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="open">Open</option>
        </select>

        {pools.length === 0 && (
          <p className="text-center text-ink/50 py-10">No trips yet. Time to hit the road.</p>
        )}

        {pools.map(({ pool, members }) => (
          <PoolCard key={pool.id} pool={pool} memberCount={members.length} />
        ))}
      </section>
    </main>
  );
}