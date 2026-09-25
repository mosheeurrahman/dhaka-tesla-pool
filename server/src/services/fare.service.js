const BASE_FARE_PAISA = 3000; // 30.00 BDT flat pickup fee
const PER_KM_RATE_PAISA = 1500; // 15.00 BDT per km, scales with seats
const POOL_DISCOUNT_RATE = 0.20; // 20% off when genuinely pooled

// Straight-line (great-circle) distance between two lat/long points, in km.
// Deliberately not real road distance - the brief explicitly says we are
// not rebuilding Google Maps. This is a documented simplification.
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function distanceBetweenZones(pickupZone, destinationZone) {
  if (
    pickupZone.latitude == null ||
    pickupZone.longitude == null ||
    destinationZone.latitude == null ||
    destinationZone.longitude == null
  ) {
    throw new Error('Zone is missing coordinates required for distance calculation');
  }

  return haversineDistanceKm(
    Number(pickupZone.latitude),
    Number(pickupZone.longitude),
    Number(destinationZone.latitude),
    Number(destinationZone.longitude)
  );
}

// passengerFare = baseFare + distanceCharge - poolDiscount
// distanceCharge scales by seatsRequested (more seats = more of the car's
// capacity consumed); baseFare is a flat per-request pickup fee.
function calculateFare({ distanceKm, seatsRequested = 1, isPooled = false }) {
  const distanceChargePaisa = Math.round(PER_KM_RATE_PAISA * distanceKm * seatsRequested);
  const subtotalPaisa = BASE_FARE_PAISA + distanceChargePaisa;
  const poolDiscountPaisa = isPooled ? Math.round(subtotalPaisa * POOL_DISCOUNT_RATE) : 0;
  const totalFarePaisa = subtotalPaisa - poolDiscountPaisa;

  return {
    baseFarePaisa: BASE_FARE_PAISA,
    distanceKm: Number(distanceKm.toFixed(3)),
    distanceChargePaisa,
    poolDiscountPaisa,
    totalFarePaisa,
  };
}

module.exports = {
  BASE_FARE_PAISA,
  PER_KM_RATE_PAISA,
  POOL_DISCOUNT_RATE,
  haversineDistanceKm,
  distanceBetweenZones,
  calculateFare,
};