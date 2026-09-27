const fareService = require('../src/services/fare.service');

describe('fare.service - calculateFare (hand-verifiable)', () => {
  it('computes an unpooled fare for a clean 2km, 1-seat ride', () => {
    const fare = fareService.calculateFare({ distanceKm: 2, seatsRequested: 1, isPooled: false });

    expect(fare.baseFarePaisa).toBe(3000);
    expect(fare.distanceChargePaisa).toBe(3000); // 1500 * 2 * 1
    expect(fare.poolDiscountPaisa).toBe(0);
    expect(fare.totalFarePaisa).toBe(6000); // 3000 + 3000 - 0
  });

  it('applies a 20% pool discount on the same ride', () => {
    const fare = fareService.calculateFare({ distanceKm: 2, seatsRequested: 1, isPooled: true });

    expect(fare.distanceChargePaisa).toBe(3000);
    expect(fare.poolDiscountPaisa).toBe(1200); // round(6000 * 0.20)
    expect(fare.totalFarePaisa).toBe(4800); // 6000 - 1200
  });

  it('scales distance charge with seats requested', () => {
    const fare = fareService.calculateFare({ distanceKm: 2, seatsRequested: 2, isPooled: false });

    expect(fare.distanceChargePaisa).toBe(6000); // 1500 * 2 * 2
    expect(fare.totalFarePaisa).toBe(9000); // 3000 + 6000
  });
});
