"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { RIDE_STATUS_LABELS, RIDE_STATUS_PROGRESS, formatPaisa } from "@/lib/rideStatus";
import Nav from "@/components/layout/Nav";
import Button from "@/components/ui/Button";
import JourneyRoad from "@/components/ride/JourneyRoad";
import SuccessBurst from "@/components/ui/SuccessBurst";
import DhakaMap, { PATH_COLORS } from "@/components/map/DhakaMap";
import PathLegendCard from "@/components/map/PathLegendCard";
import StopsTimeline from "@/components/map/StopsTimeline";

const TERMINAL_STATUSES = ["completed", "cancelled"];
const CANCELLABLE = ["requested", "matched", "accepted", "driver_arrived"];

export default function RideDetail() {
  const { user, loading } = useRequireAuth("passenger");
  const { token } = useAuth();
  const { id } = useParams();

  const [ride, setRide] = useState(null);
  const [payment, setPayment] = useState(null);
  const [zones, setZones] = useState([]);
  const [graph, setGraph] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  const fetchRide = useCallback(async () => {
    try {
      const { data } = await api.getRide(id, token);
      setRide({ ...data.ride, poolmates: data.poolmates });
      setPayment(data.payment);
      const routeRes = await api.getRideRoute(id, token);
      setRouteInfo(routeRes.data);
    } catch (err) {
      setError(err.message);
    }
  }, [id, token]);

  useEffect(() => {
    if (!token) return;
    api.listZones().then(({ data }) => setZones(data.zones));
    api.getRouteGraph().then(({ data }) => setGraph(data.graph));
    fetchRide();
  }, [token, fetchRide]);

  useEffect(() => {
    if (!ride || TERMINAL_STATUSES.includes(ride.status)) return;
    const interval = setInterval(fetchRide, 4000);
    return () => clearInterval(interval);
  }, [ride, fetchRide]);

  async function handleCancel() {
    setBusy(true);
    setError("");
    try {
      await api.cancelRide(id, token);
      await fetchRide();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePay(method) {
    setBusy(true);
    setError("");
    try {
      await api.createPayment({ ride_request_id: id, method }, token);
      await fetchRide();
      setJustPaid(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || !ride) return null;

  const pickupName = zones.find((z) => z.id === ride.pickup_zone_id)?.name;
  const destinationName = zones.find((z) => z.id === ride.destination_zone_id)?.name;

  const members = routeInfo?.poolMembers || [];
  const progress = routeInfo?.progress;
  const paths = members.length
    ? members.map((m, i) => ({
        codes: m.path,
        color: PATH_COLORS[i % PATH_COLORS.length],
        label: m.is_you ? `${m.passenger_name} (You)` : m.passenger_name,
      }))
    : routeInfo?.ownPath?.length
    ? [{ codes: routeInfo.ownPath, color: PATH_COLORS[0], label: "You" }]
    : [];

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-center font-display text-2xl font-bold text-rickshaw-green mb-6">
          {RIDE_STATUS_LABELS[ride.status]}
        </p>

        <JourneyRoad
          pickupName={pickupName}
          destinationName={destinationName}
          progress={RIDE_STATUS_PROGRESS[ride.status] ?? 0}
          muted={ride.status === "cancelled"}
        />

        <div className="flex justify-between items-center mt-6 border-t-2 border-rickshaw-green/10 pt-5">
          <span className="text-ink/60">Your fare</span>
          <span className="font-display text-xl font-bold text-rickshaw-red">
            {formatPaisa(ride.final_fare_paisa ?? ride.estimated_fare_paisa)}
          </span>
        </div>

        {ride.poolmates?.length > 0 && (
          <div className="mt-6 border-2 border-dusk-teal/30 bg-cream-dark/30 rounded-2xl p-4 text-center">
            <p className="font-display font-semibold text-rickshaw-green">
              You're riding with {ride.poolmates.join(" & ")}!
            </p>
          </div>
        )}

        {graph && routeInfo && ride.status !== "cancelled" && paths.length > 0 && (
          <div className="mt-6">
            <DhakaMap
              graph={graph}
              paths={paths}
              spine={progress?.spine || []}
              vehiclePosition={progress?.vehiclePosition}
            />

            {progress && progress.events.length > 0 && (
              <StopsTimeline
                graph={graph}
                events={progress.events}
                currentStopIndex={progress.currentStopIndex}
                active={["driver_arrived", "started"].includes(progress.poolStatus)}
              />
            )}

            <div className="mt-4 space-y-2">
              {members.map((m, i) => (
                <PathLegendCard
                  key={m.pool_member_id}
                  label={m.is_you ? `${m.passenger_name} (You)` : m.passenger_name}
                  color={PATH_COLORS[i % PATH_COLORS.length]}
                  pathNames={m.path_names}
                  distanceKm={m.distance_km}
                  farePaisa={m.agreed_fare_paisa}
                />
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-rickshaw-red text-sm mt-4">{error}</p>}

        {CANCELLABLE.includes(ride.status) && (
          <Button variant="outline" className="w-full mt-6" onClick={handleCancel} disabled={busy}>
            Cancel Ride
          </Button>
        )}

        {ride.status === "completed" && !payment && (
          <div className="mt-6 border-2 border-marigold/40 rounded-2xl p-4 text-center">
            <p className="font-display font-semibold mb-3">You've arrived! How would you like to pay?</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => handlePay("cash")} disabled={busy}>Cash</Button>
              <Button variant="secondary" onClick={() => handlePay("teslapay")} disabled={busy}>TeslaPay</Button>
            </div>
          </div>
        )}

        {payment && (
          <div className="text-center mt-6">
            {justPaid && <SuccessBurst />}
            <p className="text-rickshaw-green font-semibold">
              Paid via {payment.method === "teslapay" ? "TeslaPay" : "cash"} ✓
            </p>
          </div>
        )}
      </section>
    </main>
  );
}