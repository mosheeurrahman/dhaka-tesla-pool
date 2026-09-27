const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const PASSENGER_ONE_EMAIL = 'test.ride.passenger1@dhakateslapool.test';
const PASSENGER_TWO_EMAIL = 'test.ride.passenger2@dhakateslapool.test';
const DRIVER_EMAIL = 'test.ride.driver@dhakateslapool.test';
const PASSWORD = 'oi_mama_jaben@123';

async function cleanup() {
  const users = await prisma.users.findMany({
    where: { email: { in: [PASSENGER_ONE_EMAIL, PASSENGER_TWO_EMAIL, DRIVER_EMAIL] } },
  });
  const userIds = users.map((u) => u.id);

  if (userIds.length) {
    const rides = await prisma.ride_requests.findMany({ where: { passenger_id: { in: userIds } } });
    const rideIds = rides.map((r) => r.id);

    if (rideIds.length) {
      await prisma.pool_members.deleteMany({ where: { ride_request_id: { in: rideIds } } });
      await prisma.ride_status_history.deleteMany({ where: { ride_request_id: { in: rideIds } } });
      await prisma.ride_requests.deleteMany({ where: { id: { in: rideIds } } });
    }
  }

  await prisma.users.deleteMany({
    where: { email: { in: [PASSENGER_ONE_EMAIL, PASSENGER_TWO_EMAIL, DRIVER_EMAIL] } },
  });
}

let passengerOneToken;
let passengerTwoToken;
let driverToken;
let banani;
let mohakhali;
let createdRideId;

beforeAll(async () => {
  await cleanup();

  banani = await prisma.zones.findUnique({ where: { code: 'BANANI' } });
  mohakhali = await prisma.zones.findUnique({ where: { code: 'MOHAKHALI' } });

  const p1 = await request(app).post('/api/v1/auth/passenger/signup').send({
    full_name: 'Ride Test Passenger One',
    email: PASSENGER_ONE_EMAIL,
    password: PASSWORD,
  });
  passengerOneToken = p1.body.data.token;

  const p2 = await request(app).post('/api/v1/auth/passenger/signup').send({
    full_name: 'Ride Test Passenger Two',
    email: PASSENGER_TWO_EMAIL,
    password: PASSWORD,
  });
  passengerTwoToken = p2.body.data.token;

  const d1 = await request(app).post('/api/v1/auth/driver/signup').send({
    full_name: 'Ride Test Driver',
    email: DRIVER_EMAIL,
    password: PASSWORD,
  });
  driverToken = d1.body.data.token;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Ride requests', () => {
  it('lets a passenger request a ride with a computed fare', async () => {
    const res = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerOneToken}`)
      .send({
        pickup_zone_id: banani.id,
        destination_zone_id: mohakhali.id,
        seats_requested: 1,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.ride.status).toBe('matched');
    expect(Number(res.body.data.ride.estimated_fare_paisa)).toBeGreaterThan(0);
    createdRideId = res.body.data.ride.id;
  });

  it('rejects same pickup and destination zone', async () => {
    const res = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerOneToken}`)
      .send({ pickup_zone_id: banani.id, destination_zone_id: banani.id });

    expect(res.statusCode).toBe(400);
  });

  it('rejects a driver trying to request a ride', async () => {
    const res = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ pickup_zone_id: banani.id, destination_zone_id: mohakhali.id });

    expect(res.statusCode).toBe(403);
  });

  it("lists the passenger's own ride history", async () => {
    const res = await request(app)
      .get('/api/v1/rides/me')
      .set('Authorization', `Bearer ${passengerOneToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.rides.length).toBeGreaterThanOrEqual(1);
  });

  it('lets the owner fetch the ride by id', async () => {
    const res = await request(app)
      .get(`/api/v1/rides/${createdRideId}`)
      .set('Authorization', `Bearer ${passengerOneToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.ride.id).toBe(createdRideId);
  });

  it('blocks a different passenger from viewing the ride', async () => {
    const res = await request(app)
      .get(`/api/v1/rides/${createdRideId}`)
      .set('Authorization', `Bearer ${passengerTwoToken}`);

    expect(res.statusCode).toBe(403);
  });

  it('shows a status history entry for the initial request', async () => {
    const res = await request(app)
      .get(`/api/v1/rides/${createdRideId}/history`)
      .set('Authorization', `Bearer ${passengerOneToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.history.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.history[0].status).toBe('requested');
  });

  it('lets the owner cancel the ride', async () => {
    const res = await request(app)
      .patch(`/api/v1/rides/${createdRideId}/cancel`)
      .set('Authorization', `Bearer ${passengerOneToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.ride.status).toBe('cancelled');
  });

  it('rejects cancelling an already-cancelled ride', async () => {
    const res = await request(app)
      .patch(`/api/v1/rides/${createdRideId}/cancel`)
      .set('Authorization', `Bearer ${passengerOneToken}`);

    expect(res.statusCode).toBe(400);
  });

  it('blocks a different passenger from cancelling the ride', async () => {
    const res = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerOneToken}`)
      .send({ pickup_zone_id: banani.id, destination_zone_id: mohakhali.id });
    const otherRideId = res.body.data.ride.id;

    const cancelRes = await request(app)
      .patch(`/api/v1/rides/${otherRideId}/cancel`)
      .set('Authorization', `Bearer ${passengerTwoToken}`);

    expect(cancelRes.statusCode).toBe(403);
  });
});