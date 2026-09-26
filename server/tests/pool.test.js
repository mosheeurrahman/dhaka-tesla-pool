const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const DRIVER_EMAIL = 'test.pool.driver@dhakateslapool.test';
const OTHER_DRIVER_EMAIL = 'test.pool.otherdriver@dhakateslapool.test';
const PASSENGER_A_EMAIL = 'test.pool.passengerA@dhakateslapool.test';
const PASSENGER_B_EMAIL = 'test.pool.passengerB@dhakateslapool.test';
const PASSENGER_C_EMAIL = 'test.pool.passengerC@dhakateslapool.test';
const PASSENGER_D_EMAIL = 'test.pool.passengerD@dhakateslapool.test';
const PASSWORD = 'password123';
const PLATE = 'TEST-POOL-01';

let driverToken, otherDriverToken;
let passengerAToken, passengerBToken, passengerCToken, passengerDToken;
let vehicleId;
let banani, mohakhali, gulshan1, dhanmondi;

async function cleanup() {
  const emails = [
    DRIVER_EMAIL, OTHER_DRIVER_EMAIL,
    PASSENGER_A_EMAIL, PASSENGER_B_EMAIL, PASSENGER_C_EMAIL, PASSENGER_D_EMAIL,
  ];
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
    if (vehicleIds.length) {
      await prisma.pools.deleteMany({ where: { vehicle_id: { in: vehicleIds } } });
    }

    if (rideIds.length) {
      await prisma.ride_requests.deleteMany({ where: { id: { in: rideIds } } });
    }
    await prisma.vehicles.deleteMany({ where: { driver_id: { in: userIds } } });
  }

  await prisma.users.deleteMany({ where: { email: { in: emails } } });
}

async function signup(role, email) {
  const res = await request(app)
    .post(`/api/v1/auth/${role}/signup`)
    .send({ full_name: `Pool Test ${role}`, email, password: PASSWORD });
  return res.body.data.token;
}

async function requestRide(token, pickupZoneId, destinationZoneId, seats = 1) {
  const res = await request(app)
    .post('/api/v1/rides')
    .set('Authorization', `Bearer ${token}`)
    .send({ pickup_zone_id: pickupZoneId, destination_zone_id: destinationZoneId, seats_requested: seats });
  return res.body.data.ride;
}

beforeAll(async () => {
  await cleanup();

  banani = await prisma.zones.findUnique({ where: { code: 'BANANI' } });
  mohakhali = await prisma.zones.findUnique({ where: { code: 'MOHAKHALI' } });
  gulshan1 = await prisma.zones.findUnique({ where: { code: 'GULSHAN1' } });
  dhanmondi = await prisma.zones.findUnique({ where: { code: 'DHAHANMANDI' } });

  driverToken = await signup('driver', DRIVER_EMAIL);
  otherDriverToken = await signup('driver', OTHER_DRIVER_EMAIL);
  passengerAToken = await signup('passenger', PASSENGER_A_EMAIL);
  passengerBToken = await signup('passenger', PASSENGER_B_EMAIL);
  passengerCToken = await signup('passenger', PASSENGER_C_EMAIL);
  passengerDToken = await signup('passenger', PASSENGER_D_EMAIL);

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

describe('Tesla pooling - matching, capacity, lifecycle', () => {
  let poolId, rideA, rideB;

  it('creates a pool from a single ride request and marks it matched', async () => {
    rideA = await requestRide(passengerAToken, banani.id, mohakhali.id, 1);

    const res = await request(app)
      .post('/api/v1/pools')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ vehicle_id: vehicleId, ride_request_id: rideA.id });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.pool.status).toBe('open');
    poolId = res.body.data.pool.id;

    const updatedRide = await prisma.ride_requests.findUnique({ where: { id: rideA.id } });
    expect(updatedRide.status).toBe('matched');
  });

  it('rejects joining with a mismatched pickup zone', async () => {
    const mismatchedRide = await requestRide(passengerDToken, dhanmondi.id, gulshan1.id, 1);

    const res = await request(app)
      .post(`/api/v1/pools/${poolId}/join`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ ride_request_id: mismatchedRide.id });

    expect(res.statusCode).toBe(400);
  });

  it('lets a matching second ride join and recalculates both fares fairly', async () => {
    rideB = await requestRide(passengerBToken, banani.id, gulshan1.id, 1);
    const soloFareB = Number(rideB.estimated_fare_paisa);

    const res = await request(app)
      .post(`/api/v1/pools/${poolId}/join`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ ride_request_id: rideB.id });

    expect(res.statusCode).toBe(200);

    const updatedRideA = await prisma.ride_requests.findUnique({ where: { id: rideA.id } });
    const updatedRideB = await prisma.ride_requests.findUnique({ where: { id: rideB.id } });

    expect(Number(updatedRideA.final_fare_paisa)).toBeLessThan(Number(rideA.estimated_fare_paisa));
    expect(Number(updatedRideB.final_fare_paisa)).toBeLessThan(soloFareB);
  });

  it('blocks a different driver from accepting the pool', async () => {
    const res = await request(app)
      .patch(`/api/v1/pools/${poolId}/accept`)
      .set('Authorization', `Bearer ${otherDriverToken}`);

    expect(res.statusCode).toBe(403);
  });

  it('runs the pool through its full lifecycle, cascading to rides and members', async () => {
    expect((await request(app).patch(`/api/v1/pools/${poolId}/accept`).set('Authorization', `Bearer ${driverToken}`)).statusCode).toBe(200);
    expect((await request(app).patch(`/api/v1/pools/${poolId}/arrived`).set('Authorization', `Bearer ${driverToken}`)).statusCode).toBe(200);
    expect((await request(app).patch(`/api/v1/pools/${poolId}/start`).set('Authorization', `Bearer ${driverToken}`)).statusCode).toBe(200);

    const midRideA = await prisma.ride_requests.findUnique({ where: { id: rideA.id } });
    expect(midRideA.status).toBe('started');

    expect((await request(app).patch(`/api/v1/pools/${poolId}/complete`).set('Authorization', `Bearer ${driverToken}`)).statusCode).toBe(200);

    const finalRideA = await prisma.ride_requests.findUnique({ where: { id: rideA.id } });
    const finalRideB = await prisma.ride_requests.findUnique({ where: { id: rideB.id } });
    expect(finalRideA.status).toBe('completed');
    expect(finalRideB.status).toBe('completed');

    const members = await prisma.pool_members.findMany({ where: { pool_id: poolId } });
    expect(members.every((m) => m.status === 'completed')).toBe(true);
  });

  it('rejects completing an already-completed pool', async () => {
    const res = await request(app)
      .patch(`/api/v1/pools/${poolId}/complete`)
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.statusCode).toBe(400);
  });
});

describe('Tesla pooling - concurrency: last-seat race (Section 14 of the brief)', () => {
  it('never overbooks when two joins race for the last seat', async () => {
    const firstRide = await requestRide(passengerAToken, banani.id, mohakhali.id, 2);

    const createRes = await request(app)
      .post('/api/v1/pools')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ vehicle_id: vehicleId, ride_request_id: firstRide.id, seats_allocated: 2 });
    const racePoolId = createRes.body.data.pool.id;

    const rideB = await requestRide(passengerBToken, banani.id, gulshan1.id, 1);
    const rideC = await requestRide(passengerCToken, banani.id, gulshan1.id, 1);

    // Fire both joins at nearly the same instant - only one seat remains.
    const [resB, resC] = await Promise.all([
      request(app)
        .post(`/api/v1/pools/${racePoolId}/join`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ ride_request_id: rideB.id }),
      request(app)
        .post(`/api/v1/pools/${racePoolId}/join`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ ride_request_id: rideC.id }),
    ]);

    const statusCodes = [resB.statusCode, resC.statusCode].sort();
    expect(statusCodes).toEqual([200, 400]);

    const members = await prisma.pool_members.findMany({
      where: { pool_id: racePoolId, status: 'active' },
    });
    const totalSeats = members.reduce((sum, m) => sum + m.seats_allocated, 0);
    expect(totalSeats).toBe(3); // never 4 - capacity never exceeded
  });
});