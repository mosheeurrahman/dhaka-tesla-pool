export const RIDE_STATUS_LABELS = {
  requested: "Looking for a Tesla...",
  matched: "Finding a seat...",
  accepted: "Tesla found! Matching your route...",
  driver_arrived: "Your Tesla has arrived",
  started: "On the way",
  completed: "You've arrived!",
  cancelled: "Ride cancelled",
};

export const RIDE_STATUS_PROGRESS = {
  requested: 5,
  matched: 25,
  accepted: 45,
  driver_arrived: 65,
  started: 85,
  completed: 100,
  cancelled: 0,
};

export function formatPaisa(paisa) {
  const taka = Number(paisa) / 100;
  return `৳${taka.toFixed(2)}`;
}