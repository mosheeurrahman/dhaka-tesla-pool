"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatPaisa, POOL_STATUS_LABELS, POOL_STATUS_PROGRESS } from "@/lib/rideStatus";
import Nav from "@/components/layout/Nav";
import Button from "@/components/ui/Button";
import Seats from "@/components/pool/Seats";
import JourneyRoad from "@/components/ride/JourneyRoad";
import DhakaMap, { PATH_COLORS } from "@/components/map/DhakaMap";
import PathLegendCard from "@/components/map/PathLegendCard";
import StopsTimeline from "@/components/map/StopsTimeline";

const NEXT_ACTION = {
  accepted: { label: "I've arrived at the pickup", fn: "markPoolArrived" },
  driver_arrived: { label: "Start Trip", fn: "startPool" },
};

export default function PoolDetail() {
  const { user, loading } = useRequireAuth("driver");
  const { token } = useAuth();
  const { id } = useParams();

  const [graph, setGraph] = useState(null);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchRoute = useCallback(async () => {
    try {
      const { data } = await api.getCombinedRoute(id, token);
      setRoute(data.route);
    } catch (err) {
      setError(err.message);
    }
  }, [id, token]);

  useEffect(() => {
    if (!token) return;
    api.getRouteGraph().then(({ data }) => setGraph(data.graph));
    fetchRoute();
  }, [token, fetchRoute]);

  const status = route?.pool.status;
  useEffect(() => {
    if (!status || ["completed", "cancelled"].includes(status)) return;
    const interval = setInterval(fetchRoute, 5000);
    return () => clearInterval(interval);
  }, [status, fetchRoute]);

  async function runAction(fn) {
    setBusy(true);
    setError("");
    try {
      await api[fn](id, token);
      await fetchRoute();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return null;

  if (!route) {
    return (
      <main className="min-h-screen">
        <Nav />
        <section className="max-w-2xl mx-auto px-6 py-10 text-center">
          {error ? <p className="text-rickshaw-red">{error}</p> : <p className="text-ink/50">Loading ride...</p>}
        </section>
      </main>
    );
  }

  const { pool, members, events, currentStopIndex } = route;
  const action = NEXT_ACTION[pool.status];
  const totalFare = members.reduce((sum, m) => sum + Number(m.agreed_fare_paisa), 0);
  const remainingStops = new Set(events.slice(currentStopIndex).map((e) => e.pos)).size;
  const seatMembers = members.map((m) => ({ ...m, status: "active" }));
  const pickupName = route.spine_names[0];
  const destinationName = route.spine_names[route.spine_names.length - 1];

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-rickshaw-green text-center mb-1">
          {POOL_STATUS_LABELS[pool.status]}
        </h1>
        <p className="text-center text-ink/60 mb-2">
          {members.length} passenger{members.length !== 1 ? "s" : ""} · {pool.capacity_snapshot} seats
        </p>

        <Seats capacity={pool.capacity_snapshot} members={seatMembers} />

        <JourneyRoad
          pickupName={pickupName}
          destinationName={destinationName}
          progress={POOL_STATUS_PROGRESS[pool.status] ?? 0}
          muted={pool.status === "cancelled"}
        />

        {graph && (
          <div className="mt-4">
            <DhakaMap
              graph={graph}
              spine={route.spine}
              vehiclePosition={route.vehiclePosition}
              paths={members.map((m, i) => ({
                codes: m.path,
                color: PATH_COLORS[i % PATH_COLORS.length],
                label: m.passenger_name,
              }))}
            />

            <StopsTimeline
              graph={graph}
              events={events}
              currentStopIndex={currentStopIndex}
              active={["driver_arrived", "started"].includes(pool.status)}
            />

            <div className="mt-4 space-y-2">
              {members.map((m, i) => (
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

        {pool.status === "started" && (
          <div className="mt-6 text-center">
            <p className="text-sm text-ink/60 mb-2">
              {remainingStops > 0
                ? `${remainingStops} stop${remainingStops !== 1 ? "s" : ""} remaining`
                : "All stops reached"}
            </p>
            {remainingStops > 0 ? (
              <Button className="w-full" onClick={() => runAction("advanceStop")} disabled={busy}>
                Arrived at next stop
              </Button>
            ) : (
              <Button className="w-full" onClick={() => runAction("completePool")} disabled={busy}>
                Complete Trip
              </Button>
            )}
          </div>
        )}

        {pool.status === "completed" && (
          <p className="text-center text-rickshaw-green font-display font-semibold mt-6">
            Trip completed! 🎉
          </p>
        )}

        {["accepted", "driver_arrived"].includes(pool.status) && (
          <Button variant="outline" className="w-full mt-3" onClick={() => runAction("cancelPool")} disabled={busy}>
            Cancel Pool
          </Button>
        )}
      </section>
    </main>
  );
}