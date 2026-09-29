"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Nav from "@/components/layout/Nav";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import RockingBullet from "@/components/motifs/RockingBullet";
import { formatPaisa } from "@/lib/rideStatus";

const STATUS_STYLE = {
  open: "text-marigold",
  accepted: "text-dusk-teal",
  driver_arrived: "text-dusk-teal",
  started: "text-rickshaw-green",
  completed: "text-rickshaw-green",
  cancelled: "text-ink/40",
};

export default function DriverDashboard() {
  const { user, loading } = useRequireAuth("driver");
  const { token } = useAuth();
   const router = useRouter();

  const [vehicle, setVehicle] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({ name: "Bullet", model: "", plate_number: "" });
  const [isOnline, setIsOnline] = useState(false);
  const [pools, setPools] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openPools, setOpenPools] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [{ data: vehicleData }, { data: poolsData }] = await Promise.all([
      api.getMyVehicles(token),
      api.getMyPools(token),
    ]);
    setVehicle(vehicleData.vehicles[0] || null);
    setPools(poolsData.pools);
  }, [token]);

  const refreshOpenPools = useCallback(async () => {
    if (!token) return;
    const { data } = await api.getOpenPools(token);
    setOpenPools(data.pools);
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refreshOpenPools();
    const interval = setInterval(refreshOpenPools, 5000);
    return () => clearInterval(interval);
  }, [refreshOpenPools]);

  useEffect(() => {
    if (!vehicle) return;
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, [vehicle, refresh]);

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
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(poolId) {
    setBusy(true);
    setError("");
    try {
      await api.acceptPool(poolId, token);
      router.push(`/driver/pools/${poolId}`);
    } catch (err) {
      setError(err.message);
      await refreshOpenPools();
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

  const activePools = pools.filter((p) => !["completed", "cancelled"].includes(p.status));
  const pastPools = pools.filter((p) => ["completed", "cancelled"].includes(p.status));

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-rickshaw-green">{vehicle.name}</h1>
          <p className="text-ink/60">{vehicle.model} · {vehicle.capacity} seats</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className={`font-display font-semibold ${isOnline ? "text-ink/40" : "text-rickshaw-red"}`}>
              Offline
            </span>
            <button
              role="switch"
              aria-checked={isOnline}
              onClick={toggleOnline}
              disabled={busy}
              className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                isOnline ? "bg-rickshaw-green" : "bg-ink/20"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-cream rounded-full shadow-md transition-transform duration-200 ${
                  isOnline ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
            <span className={`font-display font-semibold ${isOnline ? "text-rickshaw-green" : "text-ink/40"}`}>
              Online
            </span>
          </div>
          <p className="text-xs text-ink/40 mt-2">
            Passengers are grouped automatically. Accept a request below to take the ride.
          </p>
        </div>

        {error && <p className="text-rickshaw-red text-sm mb-4">{error}</p>}

        <h2 className="font-display text-xl font-bold text-ink mb-3">
          Available ride requests
        </h2>
        <p className="text-xs text-ink/40 mb-3">
          Visible to every online driver — first to accept gets it.
        </p>

        {!isOnline && (
          <p className="text-center text-rickshaw-red py-6">
            Please go online to see the available ride requests.
          </p>
        )}

        {isOnline && openPools.length === 0 && (
          <p className="text-center text-ink/50 py-6">
            No unassigned requests right now.
          </p>
        )}

        {isOnline && openPools.map(({ pool, members }) => {
          const expanded = expandedId === pool.id;
          const totalSeats = members.reduce(
            (sum, m) => sum + m.seats_allocated,
            0
          );

          return (
            <div
              key={pool.id}
              className="border-2 border-dusk-teal/40 rounded-2xl p-4 mb-3"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-display font-semibold">
                    {members.length} passenger
                    {members.length !== 1 ? "s" : ""} · {totalSeats} seat
                    {totalSeats !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setExpandedId(expanded ? null : pool.id)
                    }
                  >
                    {expanded ? "Hide" : "View"}
                  </Button>

                  <Button
                    onClick={() => handleAccept(pool.id)}
                    disabled={busy}
                  >
                    Accept
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-ink/10 space-y-2">
                  {members.map((m) => (
                    <div key={m.pool_member_id} className="text-sm">
                      <p className="font-semibold text-ink/80">
                        {m.passenger_name}
                      </p>
                      <p className="text-ink/60">
                        Path: {m.path_names.join(" → ")}
                      </p>
                      <p className="text-ink/50">
                        {m.distance_km} km · {formatPaisa(m.agreed_fare_paisa)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <h2 className="font-display text-xl font-bold text-ink mb-3">
          Your rides
        </h2>


        {activePools.length === 0 && (
          <div className="text-center py-10">
            <RockingBullet className="w-24 h-24 mx-auto mb-4 opacity-70" />
            <p className="text-ink/50">No active rides yet. Accept a request above to get started.</p>
          </div>
        )}

        {activePools.map((pool) => (
          <div key={pool.id} className="border-2 border-marigold/40 rounded-2xl p-4 mb-3 flex justify-between items-center">
            <span className={`font-display font-semibold capitalize ${STATUS_STYLE[pool.status]}`}>
              {pool.status.replace("_", " ")}
            </span>
            <Link href={`/driver/pools/${pool.id}`}>
              <Button>View</Button>
            </Link>
          </div>
        ))}

        {pastPools.length > 0 && (
          <>
            <h2 className="font-display text-lg font-bold text-ink mt-8 mb-3">Past rides</h2>
            {pastPools.map((pool) => (
              <div key={pool.id} className="border-2 border-ink/10 rounded-2xl p-4 mb-3 flex justify-between items-center opacity-70">
                <span className={`font-display font-semibold capitalize ${STATUS_STYLE[pool.status]}`}>
                  {pool.status.replace("_", " ")}
                </span>
                <Link href={`/driver/pools/${pool.id}`}>
                  <Button variant="outline">View</Button>
                </Link>
              </div>
            ))}
          </>
        )}
      </section>
    </main>
  );
}