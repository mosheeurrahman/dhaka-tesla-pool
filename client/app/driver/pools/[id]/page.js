"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatPaisa } from "@/lib/rideStatus";
import Nav from "@/components/layout/Nav";
import Button from "@/components/ui/Button";
import Seats from "@/components/pool/Seats";

const NEXT_ACTION = {
  open: { label: "Accept Pool", fn: "acceptPool" },
  accepted: { label: "Mark Driver Arrived", fn: "markPoolArrived" },
  driver_arrived: { label: "Start Trip", fn: "startPool" },
  started: { label: "Complete Trip", fn: "completePool" },
};

export default function PoolDetail() {
  const { user, loading } = useRequireAuth("driver");
  const { token } = useAuth();
  const { id } = useParams();

  const [pool, setPool] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchPool = useCallback(async () => {
    try {
      const { data } = await api.getPool(id, token);
      setPool(data.pool);
      setMembers(data.members);
    } catch (err) {
      setError(err.message);
    }
  }, [id, token]);

  useEffect(() => {
    if (token) fetchPool();
  }, [token, fetchPool]);

  async function handleAdvance() {
    const action = NEXT_ACTION[pool.status];
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      await api[action.fn](id, token);
      await fetchPool();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    setError("");
    try {
      await api.cancelPool(id, token);
      await fetchPool();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || !pool) return null;

  const action = NEXT_ACTION[pool.status];
  const totalFare = members
    .filter((m) => m.status === "active")
    .reduce((sum, m) => sum + Number(m.agreed_fare_paisa), 0);

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-lg mx-auto px-6 py-10 text-center">
        <h1 className="font-display text-2xl font-bold text-rickshaw-green mb-1 capitalize">
          Pool {pool.status.replace("_", " ")}
        </h1>
        <p className="text-ink/60 mb-4">
          {members.filter((m) => m.status === "active").length} / {pool.capacity_snapshot} seats filled
        </p>

        <Seats capacity={pool.capacity_snapshot} members={members} />

        <p className="text-ink/70 mt-4">Total fare this trip: {formatPaisa(totalFare)}</p>

        {error && <p className="text-rickshaw-red text-sm mt-4">{error}</p>}

        {action && (
          <Button className="w-full mt-6" onClick={handleAdvance} disabled={busy}>
            {action.label}
          </Button>
        )}

        {pool.status === "completed" && (
          <p className="text-rickshaw-green font-display font-semibold mt-6">Trip completed! 🎉</p>
        )}

        {!["completed", "cancelled"].includes(pool.status) && (
          <Button variant="outline" className="w-full mt-3" onClick={handleCancel} disabled={busy}>
            Cancel Pool
          </Button>
        )}
      </section>
    </main>
  );
}