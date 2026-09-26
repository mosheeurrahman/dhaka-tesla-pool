"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Nav from "@/components/layout/Nav";
import RideCard from "@/components/ride/RideCard";
import RockingBullet from "@/components/motifs/RockingBullet";

export default function RideHistory() {
  const { user, loading } = useRequireAuth("passenger");
  const { token } = useAuth();
  const [rides, setRides] = useState([]);
  const [zones, setZones] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (!token) return;
    api.listZones().then(({ data }) => setZones(data.zones));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.getMyRides(token, statusFilter || undefined).then(({ data }) => setRides(data.rides));
  }, [token, statusFilter]);

  if (loading || !user) return null;

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-bold text-rickshaw-green mb-6 text-center">
          Your journeys
        </h1>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="mb-6 bg-cream border-2 border-rickshaw-green/30 rounded-xl px-4 py-2 font-body"
        >
          <option value="">All rides</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="requested">Requested</option>
        </select>

        {rides.length === 0 && (
          <div className="text-center py-10">
            <RockingBullet className="w-24 h-24 mx-auto mb-4 opacity-70" />
            <p className="text-ink/50">Bullet hasn't taken you anywhere yet. Time to change that.</p>
          </div>
        )}

        {rides.map((ride) => (
          <RideCard
            key={ride.id}
            ride={ride}
            pickupName={zones.find((z) => z.id === ride.pickup_zone_id)?.name}
            destinationName={zones.find((z) => z.id === ride.destination_zone_id)?.name}
          />
        ))}
      </section>
    </main>
  );
}