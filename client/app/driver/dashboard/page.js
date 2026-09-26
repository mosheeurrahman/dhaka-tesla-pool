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
import RockingBullet from "@/components/motifs/RockingBullet";

export default function DriverDashboard() {
  const { user, loading } = useRequireAuth("driver");
  const { token } = useAuth();
  const router = useRouter();

  const [vehicle, setVehicle] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({ name: "Bullet", model: "", plate_number: "" });
  const [isOnline, setIsOnline] = useState(false);
  const [openPool, setOpenPool] = useState(null);
  const [zones, setZones] = useState([]);
  const [requests, setRequests] = useState([]);
  const [zoneFilter, setZoneFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [{ data: vehicleData }, { data: openPoolData }] = await Promise.all([
      api.getMyVehicles(token),
      api.getMyPools(token, "open"),
    ]);
    setVehicle(vehicleData.vehicles[0] || null);
    setOpenPool(openPoolData.pools[0] || null);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.listZones().then(({ data }) => setZones(data.zones));
    refresh();
  }, [token, refresh]);

  useEffect(() => {
    if (!token) return;
    api.getAvailableRequests(token, zoneFilter || undefined).then(({ data }) => setRequests(data.requests));
  }, [token, zoneFilter, openPool]);

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
      const { data } = await api.createPool(
        { vehicle_id: vehicle.id, ride_request_id: rideId },
        token
      );
      router.push(`/driver/pools/${data.pool.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinPool(rideId) {
    setBusy(true);
    setError("");
    try {
      await api.joinPool(openPool.id, { ride_request_id: rideId }, token);
      router.push(`/driver/pools/${openPool.id}`);
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
            <Input
              label="Vehicle name"
              required
              value={vehicleForm.name}
              onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
            />
            <Input
              label="Model"
              required
              value={vehicleForm.model}
              onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
            />
            <Input
              label="Plate number"
              required
              value={vehicleForm.plate_number}
              onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })}
            />
            {error && <p className="text-rickshaw-red text-sm">{error}</p>}
            <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
              Register Vehicle
            </Button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-rickshaw-green">{vehicle.name}</h1>
          <p className="text-ink/60">
            {vehicle.model} · {vehicle.capacity} seats
          </p>
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

        {openPool && (
          <div className="border-2 border-marigold/40 rounded-2xl p-4 mb-6 text-center">
            <p className="font-display font-semibold mb-2">You have an open pool</p>
            <a href={`/driver/pools/${openPool.id}`} className="text-rickshaw-green font-semibold underline">
              View pool
            </a>
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
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>

        {error && <p className="text-rickshaw-red text-sm mb-4">{error}</p>}

        {requests.length === 0 && (
          <div className="text-center py-10">
            <RockingBullet className="w-24 h-24 mx-auto mb-4 opacity-70" />
            <p className="text-ink/50">Bullet is taking a break. No riders waiting yet.</p>
          </div>
        )}

        {requests.map((r) => (
          <div key={r.id} className="border-2 border-rickshaw-green/20 rounded-2xl p-4 mb-3 flex justify-between items-center">
            <div>
              <p className="font-display font-semibold">{r.seats_requested} seat(s) requested</p>
              <p className="text-sm text-ink/60">{formatPaisa(r.estimated_fare_paisa)}</p>
            </div>
            <Button
              variant={openPool ? "secondary" : "primary"}
              disabled={busy}
              onClick={() => (openPool ? handleJoinPool(r.id) : handleStartPool(r.id))}
            >
              {openPool ? "Add to Pool" : "Start Pool"}
            </Button>
          </div>
        ))}
      </section>
    </main>
  );
}