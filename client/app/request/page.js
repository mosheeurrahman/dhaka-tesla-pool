"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatPaisa } from "@/lib/rideStatus";
import Nav from "@/components/layout/Nav";
import Button from "@/components/ui/Button";
import Vine from "@/components/motifs/Vine";
import SearchingOverlay from "@/components/ride/SearchingOverlay";
import DhakaMap, { PATH_COLORS } from "@/components/map/DhakaMap";

export default function RequestRide() {
  const { user, loading } = useRequireAuth("passenger");
  const { token } = useAuth();
  const router = useRouter();

  const [zones, setZones] = useState([]);
  const [graph, setGraph] = useState(null);
  const [pickupId, setPickupId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [seats, setSeats] = useState(1);
  const [fare, setFare] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [fareLoading, setFareLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSearching, setShowSearching] = useState(false);
  const [createdRideId, setCreatedRideId] = useState(null);

  const pickupCode = zones.find((z) => z.id === pickupId)?.code;
  const destinationCode = zones.find((z) => z.id === destinationId)?.code;

  useEffect(() => {
    api.listZones().then(({ data }) => setZones(data.zones));
    api.getRouteGraph().then(({ data }) => setGraph(data.graph));
  }, []);

  useEffect(() => {
    if (!pickupId || !destinationId || pickupId === destinationId) {
      setFare(null);
      setRoutePath([]);
      return;
    }
    setFareLoading(true);
    setError("");
    api
      .getFareEstimate({
        pickup_zone_id: pickupId,
        destination_zone_id: destinationId,
        seats_requested: seats,
        pooled: "true",
      })
      .then(({ data }) => {
        setFare(data.fare);
        setRoutePath(data.route?.path || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setFareLoading(false));
  }, [pickupId, destinationId, seats]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.createRide(
        { pickup_zone_id: pickupId, destination_zone_id: destinationId, seats_requested: seats },
        token
      );
      setCreatedRideId(data.ride.id);
      setShowSearching(true);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-bold text-rickshaw-green text-center mb-2">
          Where's Bullet taking you?
        </h1>
        <div className="flex justify-center mb-8">
          <Vine className="w-40 h-5" color="var(--color-rickshaw-green)" />
        </div>

        <DhakaMap
          graph={graph}
          pickupCode={pickupCode}
          destinationCode={destinationCode}
          paths={
            routePath.length
              ? [{ codes: routePath, color: PATH_COLORS[0], label: "Your route" }]
              : []
          }
        />

        <form onSubmit={handleSubmit} className="space-y-5 mt-6">
          <label className="block">
            <span className="font-body text-sm font-medium text-ink/80 mb-1 block">Pickup</span>
            <select
              required
              value={pickupId}
              onChange={(e) => setPickupId(e.target.value)}
              className="w-full bg-cream border-2 border-rickshaw-green/30 rounded-xl px-4 py-3 font-body focus:outline-none focus:ring-2 focus:ring-marigold"
            >
              <option value="">Choose a zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-body text-sm font-medium text-ink/80 mb-1 block">Destination</span>
            <select
              required
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              className="w-full bg-cream border-2 border-rickshaw-green/30 rounded-xl px-4 py-3 font-body focus:outline-none focus:ring-2 focus:ring-marigold"
            >
              <option value="">Choose a zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-body text-sm font-medium text-ink/80 mb-1 block">Seats</span>
            <select
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="w-full bg-cream border-2 border-rickshaw-green/30 rounded-xl px-4 py-3 font-body focus:outline-none focus:ring-2 focus:ring-marigold"
            >
              <option value={1}>1 seat</option>
              <option value={2}>2 seats</option>
              <option value={3}>3 seats</option>
            </select>
          </label>

          {pickupId && pickupId === destinationId && (
            <p className="text-rickshaw-red text-sm">Pickup and destination can't be the same.</p>
          )}

          {fareLoading && <p className="text-ink/60 text-sm">Working out the fare...</p>}

          {fare && (
            <div className="border-2 border-marigold/40 bg-cream-dark/40 rounded-2xl p-4 text-center">
              <p className="text-sm text-ink/70">Estimated fare if pooled</p>
              <p className="font-display text-2xl font-bold text-rickshaw-red">
                {formatPaisa(fare.totalFarePaisa)}
              </p>
              <p className="text-xs text-ink/50 mt-1">{fare.distanceKm} km</p>
            </div>
          )}

          {error && <p className="text-rickshaw-red text-sm">{error}</p>}

          <Button type="submit" className="w-full text-lg" disabled={submitting || !fare}>
            {submitting ? "Preparing your ride..." : "Find My Tesla"}
          </Button>
        </form>
      </section>
      {showSearching && (
        <SearchingOverlay onDone={() => router.push(`/ride/${createdRideId}`)} />
      )}
    </main>
  );
}