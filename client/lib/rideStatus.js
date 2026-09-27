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

export const POOL_STATUS_LABELS = {
  open: "Waiting for more passengers...",
  accepted: "Tesla found! Getting ready...",
  driver_arrived: "Driver has arrived",
  started: "On the way",
  completed: "Trip completed!",
  cancelled: "Pool cancelled",
};

export const POOL_STATUS_PROGRESS = {
  open: 10,
  accepted: 40,
  driver_arrived: 60,
  started: 85,
  completed: 100,
  cancelled: 0,
};