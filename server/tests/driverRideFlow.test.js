const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const DRIVER_EMAIL = 'test.driverflow.driver@dhakateslapool.test';
const PASSENGER_A_EMAIL = 'test.driverflow.passengerA@dhakateslapool.test';
const PASSENGER_B_EMAIL = 'test.driverflow.passengerB@dhakateslapool.test';
const PASSWORD = 'oi_mama_jaben@123';
const PLATE = 'TEST-FLOW-01';

let driverToken, passengerAToken, passengerBToken;
let vehicleId;
let banani, mohakhali, gulshan1;

async function cleanup() {
  const emails = [DRIVER_EMAIL, PASSENGER_A_EMAIL, PASSENGER_B_EMAIL];
  const users = await prisma.users.findMany({ where: { email: { in: emails } } });
  const userIds = users.map((u) => u.id);

  if (userIds.length) {
    const rides = await prisma.ride_requests.findMany({ where: { passenger_id: { in: userIds } } });
    const rideIds = rides.map((r) => r.id);
    if (rideIds.length) {
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

async function signup(role, email) {
  const res = await request(app)
    .post(`/api/v1/auth/${role}/signup`)
    .send({ full_name: `Flow Test ${role}`, email, password: PASSWORD });
  return res.body.data.token;
}

async function requestRide(token, pickupZoneId, destinationZoneId) {
  const res = await request(app)
    .post('/api/v1/rides')
    .set('Authorization', `Bearer ${token}`)
    .send({ pickup_zone_id: pickupZoneId, destination_zone_id: destinationZoneId, seats_requested: 1 });
  return res.body.data.ride;
}

beforeAll(async () => {
  await cleanup();

  banani = await prisma.zones.findUnique({ where: { code: 'BANANI' } });
  mohakhali = await prisma.zones.findUnique({ where: { code: 'MOHAKHALI' } });
  gulshan1 = await prisma.zones.findUnique({ where: { code: 'GULSHAN1' } });

  driverToken = await signup('driver', DRIVER_EMAIL);
  passengerAToken = await signup('passenger', PASSENGER_A_EMAIL);
  passengerBToken = await signup('passenger', PASSENGER_B_EMAIL);

  const vehicleRes = await request(app)
    .post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${driverToken}`)
    .send({ name: 'Bullet', model: 'Model 3', plate_number: PLATE, capacity: 3 });
  vehicleId = vehicleRes.body.data.vehicle.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Driver ride flow', () => {
  let sharedPoolId;

  it('shows available unmatched requests filtered by pickup zone', async () => {
    await requestRide(passengerAToken, banani.id, mohakhali.id);

    const res = await request(app)
      .get('/api/v1/pools/available-requests')
      .query({ pickup_zone_id: banani.id })
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.requests.length).toBeGreaterThanOrEqual(1);
  });

  it('returns detailed pools with passenger names for the dashboard view', async () => {
    const ride = await requestRide(passengerBToken, banani.id, gulshan1.id);
    const poolRes = await request(app)
      .post('/api/v1/pools')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ vehicle_id: vehicleId, ride_request_id: ride.id });

    expect(poolRes.statusCode).toBe(201);
    sharedPoolId = poolRes.body.data.pool.id;

    const res = await request(app)
      .get('/api/v1/pools/mine/detailed')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.pools.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pools[0].members[0].passenger_name).toBeDefined();
  });

  it("frees the seat when a passenger cancels a ride already inside the pool", async () => {
    // Join a second rider into the SAME still-open pool from the previous
    // test, rather than creating a new one - a vehicle can only have one
    // active pool at a time (see one_active_pool_per_vehicle).
    const ride = await requestRide(passengerAToken, banani.id, mohakhali.id);
    const joinRes = await request(app)
      .post(`/api/v1/pools/${sharedPoolId}/join`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ ride_request_id: ride.id });
    expect(joinRes.statusCode).toBe(200);

    await request(app)
      .patch(`/api/v1/rides/${ride.id}/cancel`)
      .set('Authorization', `Bearer ${passengerAToken}`);

    const membership = await prisma.pool_members.findFirst({ where: { ride_request_id: ride.id } });
    expect(membership.status).toBe('cancelled');

    // Seat is free again - a new ride should be able to join the same pool
    const newRide = await requestRide(passengerBToken, banani.id, gulshan1.id);
    const rejoinRes = await request(app)
      .post(`/api/v1/pools/${sharedPoolId}/join`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ ride_request_id: newRide.id });

    expect(rejoinRes.statusCode).toBe(200);
  });
});