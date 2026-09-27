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
import DhakaMap, { PATH_COLORS } from "@/components/map/DhakaMap";
import PathLegendCard from "@/components/map/PathLegendCard";

const NEXT_ACTION = {
  open: { label: "Accept Pool", fn: "acceptPool" },
  accepted: { label: "Mark Driver Arrived", fn: "markPoolArrived" },
  driver_arrived: { label: "Start Trip", fn: "startPool" },
};

export default function PoolDetail() {
  const { user, loading } = useRequireAuth("driver");
  const { token } = useAuth();
  const { id } = useParams();

  const [pool, setPool] = useState(null);
  const [members, setMembers] = useState([]);
  const [graph, setGraph] = useState(null);
  const [combined, setCombined] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: detail }, { data: routeData }] = await Promise.all([
        api.getPool(id, token),
        api.getCombinedRoute(id, token),
      ]);
      setPool(detail.pool);
      setMembers(detail.members);
      setCombined(routeData.route);
    } catch (err) {
      setError(err.message);
    }
  }, [id, token]);

  useEffect(() => {
    if (!token) return;
    api.getRouteGraph().then(({ data }) => setGraph(data.graph));
    fetchAll();
  }, [token, fetchAll]);

  async function runAction(fn) {
    setBusy(true);
    setError("");
    try {
      await api[fn](id, token);
      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || !pool) return null;

  const action = NEXT_ACTION[pool.status];
  const activeMembers = members.filter((m) => m.status === "active");
  const totalFare = activeMembers.reduce((sum, m) => sum + Number(m.agreed_fare_paisa), 0);
  const remainingStops = combined ? combined.events.length - combined.currentStopIndex : 0;

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-rickshaw-green text-center mb-1 capitalize">
          Pool {pool.status.replace("_", " ")}
        </h1>
        <p className="text-center text-ink/60 mb-4">
          {activeMembers.length} / {pool.capacity_snapshot} seats filled
        </p>

        <Seats capacity={pool.capacity_snapshot} members={members} />

        {graph && combined && (
          <div className="mt-6">
            <DhakaMap
              graph={graph}
              vehiclePosition={combined.vehiclePosition}
              paths={activeMembers.map((m, i) => ({
                codes: m.path,
                color: PATH_COLORS[i % PATH_COLORS.length],
                label: m.passenger_name,
              }))}
            />

            {pool.status === "started" && (
              <div className="text-center mt-3">
                <p className="text-sm text-ink/60 mb-2">
                  {remainingStops > 0
                    ? `${remainingStops} stop${remainingStops !== 1 ? "s" : ""} remaining`
                    : "All stops reached"}
                </p>
                {remainingStops > 0 ? (
                  <Button onClick={() => runAction("advanceStop")} disabled={busy}>
                    Arrived at Next Stop
                  </Button>
                ) : (
                  <Button onClick={() => runAction("completePool")} disabled={busy}>
                    Complete Trip
                  </Button>
                )}
              </div>
            )}

            <div className="mt-4 space-y-2">
              {activeMembers.map((m, i) => (
                <PathLegendCard
                  key={m.pool_member_id}
                  label={m.passenger_name}
                  color={PATH_COLORS[i % PATH_COLORS.length]}
                  pathNames={m.path_names}
                  distanceKm={m.distance_km}
                  farePaisa={m.agreed_fare_paisa}
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-ink/70 mt-6 font-semibold">
          Total fare this trip: <span className="text-rickshaw-red">{formatPaisa(totalFare)}</span>
        </p>

        {error && <p className="text-rickshaw-red text-sm mt-4 text-center">{error}</p>}

        {action && (
          <Button className="w-full mt-6" onClick={() => runAction(action.fn)} disabled={busy}>
            {action.label}
          </Button>
        )}

        {pool.status === "completed" && (
          <p className="text-center text-rickshaw-green font-display font-semibold mt-6">
            Trip completed! 🎉
          </p>
        )}

        {!["completed", "cancelled"].includes(pool.status) && (
          <Button variant="outline" className="w-full mt-3" onClick={() => runAction("cancelPool")} disabled={busy}>
            Cancel Pool
          </Button>
        )}
      </section>
    </main>
  );
}