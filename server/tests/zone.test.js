const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

describe('Zones and fare estimate', () => {
  let banani;
  let mohakhali;

  beforeAll(async () => {
    banani = await prisma.zones.findUnique({ where: { code: 'BANANI' } });
    mohakhali = await prisma.zones.findUnique({ where: { code: 'MOHAKHALI' } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lists all zones', async () => {
    const res = await request(app).get('/api/v1/zones');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.zones.length).toBeGreaterThanOrEqual(10);
  });

  it('returns a fare estimate for Banani -> Mohakhali', async () => {
    const res = await request(app)
      .get('/api/v1/zones/fare-estimate')
      .query({ pickup_zone_id: banani.id, destination_zone_id: mohakhali.id });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.fare.totalFarePaisa).toBeGreaterThan(0);
    expect(res.body.data.fare.poolDiscountPaisa).toBe(0);
  });

  it('applies the pool discount when pooled=true', async () => {
    const res = await request(app).get('/api/v1/zones/fare-estimate').query({
      pickup_zone_id: banani.id,
      destination_zone_id: mohakhali.id,
      pooled: 'true',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.fare.poolDiscountPaisa).toBeGreaterThan(0);
  });

  it('rejects same pickup and destination zone', async () => {
    const res = await request(app)
      .get('/api/v1/zones/fare-estimate')
      .query({ pickup_zone_id: banani.id, destination_zone_id: banani.id });

    expect(res.statusCode).toBe(400);
  });
});