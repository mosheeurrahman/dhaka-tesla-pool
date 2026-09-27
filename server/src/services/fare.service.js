const BASE_FARE_PAISA = 3000; // 30.00 BDT flat pickup fee
const PER_KM_RATE_PAISA = 1500; // 15.00 BDT per km, scales with seats
const POOL_DISCOUNT_RATE = 0.20; // 20% off when genuinely pooled



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
  calculateFare };