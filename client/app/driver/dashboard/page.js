"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatPaisa } from "@/lib/rideStatus";
import Nav from "@/components/layout/Nav";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Link from "next/link";

const NON_TERMINAL = (status) => !["completed", "cancelled"].includes(status);

export default function DriverDashboard() {
  const { user, loading } = useRequireAuth("driver");
  const { token } = useAuth();
  const router = useRouter();

  const [vehicle, setVehicle] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({ name: "Bullet", model: "", plate_number: "" });
  const [isOnline, setIsOnline] = useState(false);
  const [activePool, setActivePool] = useState(null);
  const [zones, setZones] = useState([]);
  const [requests, setRequests] = useState([]);
  const [zoneFilter, setZoneFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const zoneName = (id) => zones.find((z) => z.id === id)?.name || "...";

  const refresh = useCallback(async () => {
    if (!token) return;
    const [{ data: vehicleData }, { data: poolsData }] = await Promise.all([
      api.getMyVehicles(token),
      api.getMyPools(token),
    ]);
    setVehicle(vehicleData.vehicles[0] || null);
    setActivePool(poolsData.pools.find((p) => NON_TERMINAL(p.status)) || null);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.listZones().then(({ data }) => setZones(data.zones));
    refresh();
  }, [token, refresh]);

  useEffect(() => {
    if (!token) return;
    api.getAvailableRequests(token, zoneFilter || undefined).then(({ data }) => setRequests(data.requests));
  }, [token, zoneFilter, activePool]);

  async function handleCreateVehicle(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.createVehicle(vehicleForm, token);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleOnline() {
    const next = !isOnline;
    setBusy(true);
    try {
      await api.setDriverStatus({ is_online: next }, token);
      setIsOnline(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStartPool(rideId) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.createPool({ vehicle_id: vehicle.id, ride_request_id: rideId }, token);
      router.push(`/driver/pools/${data.pool.id}`);
    } catch (err) {
      setError(err.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinPool(rideId) {
    setBusy(true);
    setError("");
    try {
      await api.joinPool(activePool.id, { ride_request_id: rideId }, token);
      router.push(`/driver/pools/${activePool.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return null;

  if (!vehicle) {
    return (
      <main className="min-h-screen">
        <Nav />
        <section className="max-w-md mx-auto px-6 py-12">
          <h1 className="font-display text-2xl font-bold text-rickshaw-red text-center mb-6">
            Register your Tesla first
          </h1>
          <form onSubmit={handleCreateVehicle} className="space-y-4">
            <Input label="Vehicle name" required value={vehicleForm.name} onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })} />
            <Input label="Model" required value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} />
            <Input label="Plate number" required value={vehicleForm.plate_number} onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })} />
            {error && <p className="text-rickshaw-red text-sm">{error}</p>}
            <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
              Register Vehicle
            </Button>
          </form>
        </section>
      </main>
    );
  }

  const canStartNew = !activePool;
  const canJoinExisting = activePool?.status === "open";

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-rickshaw-green">{vehicle.name}</h1>
          <p className="text-ink/60">{vehicle.model} · {vehicle.capacity} seats</p>
          <button
            onClick={toggleOnline}
            disabled={busy}
            className={`btn-press mt-4 px-6 py-2 rounded-full font-display font-semibold ${
              isOnline ? "bg-rickshaw-green text-cream" : "bg-ink/10 text-ink/60"
            }`}
          >
            {isOnline ? "Online" : "Offline"} — tap to toggle
          </button>
        </div>

        {activePool && (
          <div className="border-2 border-marigold/40 rounded-2xl p-4 mb-6 text-center">
            <p className="font-display font-semibold mb-2 capitalize">
              Active pool — {activePool.status.replace("_", " ")}
            </p>
            <Link href={`/driver/pools/${activePool.id}`} className="text-rickshaw-green font-semibold underline">
              View pool
            </Link>
            {!canJoinExisting && (
              <p className="text-sm text-ink/50 mt-2">
                Finish or cancel this pool before starting a new one.
              </p>
            )}
          </div>
        )}

        <h2 className="font-display text-xl font-bold text-ink mb-3">Waiting passengers</h2>

        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="mb-4 bg-cream border-2 border-rickshaw-green/30 rounded-xl px-4 py-2 font-body"
        >
          <option value="">All pickup zones</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>

        {error && <p className="text-rickshaw-red text-sm mb-4">{error}</p>}

        {requests.length === 0 && (
          <p className="text-center text-ink/50 py-10">Bullet is taking a break. No riders waiting yet.</p>
        )}

        {requests.map((r) => {
          const expanded = expandedId === r.id;
          const canAct = canStartNew || canJoinExisting;
          return (
            <div key={r.id} className="border-2 border-rickshaw-green/20 rounded-2xl p-4 mb-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-display font-semibold">
                    {zoneName(r.pickup_zone_id)} → {zoneName(r.destination_zone_id)}
                  </p>
                  <p className="text-sm text-ink/60">{formatPaisa(r.estimated_fare_paisa)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                  >
                    {expanded ? "Hide" : "View"}
                  </Button>
                  {canAct && (
                    <Button
                      variant={canJoinExisting ? "secondary" : "primary"}
                      disabled={busy}
                      onClick={() => (canJoinExisting ? handleJoinPool(r.id) : handleStartPool(r.id))}
                    >
                      {canJoinExisting ? "Add to Pool" : "Start Pool"}
                    </Button>
                  )}
                </div>
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-ink/10 text-sm text-ink/70 space-y-1">
                  <p>Pickup: {zoneName(r.pickup_zone_id)}</p>
                  <p>Destination: {zoneName(r.destination_zone_id)}</p>
                  <p>Seats requested: {r.seats_requested}</p>
                  <p>Distance: {r.estimated_distance_km} km</p>
                  <p>Requested: {new Date(r.requested_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}