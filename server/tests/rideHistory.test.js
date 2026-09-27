const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const PASSENGER_EMAIL = 'test.history.passenger@dhakateslapool.test';
const DRIVER_EMAIL = 'test.history.driver@dhakateslapool.test';
const PASSWORD = 'oi_mama_jaben@123';
const PLATE = 'TEST-HIST-01';

let passengerToken, driverToken;
let banani, mohakhali;
let activeRideId, cancelledRideId;

async function cleanup() {
  const emails = [PASSENGER_EMAIL, DRIVER_EMAIL];
  const users = await prisma.users.findMany({ where: { email: { in: emails } } });
  const userIds = users.map((u) => u.id);
  if (userIds.length) {
    const rides = await prisma.ride_requests.findMany({ where: { passenger_id: { in: userIds } } });
    const rideIds = rides.map((r) => r.id);
    if (rideIds.length) {
      await prisma.payments.deleteMany({ where: { ride_request_id: { in: rideIds } } });
      await prisma.pool_members.deleteMany({ where: { ride_request_id: { in: rideIds } } });
      await prisma.ride_status_history.deleteMany({ where: { ride_request_id: { in: rideIds } } });
    }
    const vehicles = await prisma.vehicles.findMany({ where: { driver_id: { in: userIds } } });
    const vehicleIds = vehicles.map((v) => v.id);
    if (vehicleIds.length) await prisma.pools.deleteMany({ where: { vehicle_id: { in: vehicleIds } } });
    if (rideIds.length) await prisma.ride_requests.deleteMany({ where: { id: { in: rideIds } } });
    await prisma.vehicles.deleteMany({ where: { driver_id: { in: userIds } } });
  }
  await prisma.users.deleteMany({ where: { email: { in: emails } } });
}

beforeAll(async () => {
  await cleanup();
  banani = await prisma.zones.findUnique({ where: { code: 'BANANI' } });
  mohakhali = await prisma.zones.findUnique({ where: { code: 'MOHAKHALI' } });

  const p = await request(app).post('/api/v1/auth/passenger/signup').send({
    full_name: 'History Test Passenger', email: PASSENGER_EMAIL, password: PASSWORD,
  });
  passengerToken = p.body.data.token;

  const d = await request(app).post('/api/v1/auth/driver/signup').send({
    full_name: 'History Test Driver', email: DRIVER_EMAIL, password: PASSWORD,
  });
  driverToken = d.body.data.token;

  const r1 = await request(app)
    .post('/api/v1/rides')
    .set('Authorization', `Bearer ${passengerToken}`)
    .send({ pickup_zone_id: banani.id, destination_zone_id: mohakhali.id });
  activeRideId = r1.body.data.ride.id;

  const r2 = await request(app)
    .post('/api/v1/rides')
    .set('Authorization', `Bearer ${passengerToken}`)
    .send({ pickup_zone_id: banani.id, destination_zone_id: mohakhali.id });
  cancelledRideId = r2.body.data.ride.id;
  await request(app)
    .patch(`/api/v1/rides/${cancelledRideId}/cancel`)
    .set('Authorization', `Bearer ${passengerToken}`);
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Ride history filtering and detail', () => {
  it('lists all rides with no filter', async () => {
    const res = await request(app)
      .get('/api/v1/rides/me')
      .set('Authorization', `Bearer ${passengerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.rides.length).toBeGreaterThanOrEqual(2);
  });

  it('filters ride history by status', async () => {
    const res = await request(app)
      .get('/api/v1/rides/me')
      .query({ status: 'cancelled' })
      .set('Authorization', `Bearer ${passengerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.rides.every((r) => r.status === 'cancelled')).toBe(true);
  });

  it('rejects an invalid status filter value', async () => {
    const res = await request(app)
      .get('/api/v1/rides/me')
      .query({ status: 'not_a_real_status' })
      .set('Authorization', `Bearer ${passengerToken}`);

    expect(res.statusCode).toBe(400);
  });

  it('returns ride detail with a null payment when none exists yet', async () => {
    const res = await request(app)
      .get(`/api/v1/rides/${activeRideId}`)
      .set('Authorization', `Bearer ${passengerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.ride.id).toBe(activeRideId);
    expect(res.body.data.payment).toBeNull();
  });

  it('filters driver pool history by status', async () => {
    const res = await request(app)
      .get('/api/v1/pools/mine')
      .query({ status: 'open' })
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.pools.every((p) => p.status === 'open')).toBe(true);
  });
});