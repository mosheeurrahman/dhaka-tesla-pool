const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const DRIVER_EMAIL = 'test.payment.driver@dhakateslapool.test';
const PASSENGER_EMAIL = 'test.payment.passenger@dhakateslapool.test';
const OTHER_PASSENGER_EMAIL = 'test.payment.otherpassenger@dhakateslapool.test';
const PASSWORD = 'password123';
const PLATE = 'TEST-PAY-01';

let driverToken, passengerToken, otherPassengerToken;
let vehicleId;
let banani, mohakhali;
let completedRideId;

async function cleanup() {
  const emails = [DRIVER_EMAIL, PASSENGER_EMAIL, OTHER_PASSENGER_EMAIL];
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

async function signup(role, email) {
  const res = await request(app)
    .post(`/api/v1/auth/${role}/signup`)
    .send({ full_name: `Payment Test ${role}`, email, password: PASSWORD });
  return res.body.data.token;
}

beforeAll(async () => {
  await cleanup();

  banani = await prisma.zones.findUnique({ where: { code: 'BANANI' } });
  mohakhali = await prisma.zones.findUnique({ where: { code: 'MOHAKHALI' } });

  driverToken = await signup('driver', DRIVER_EMAIL);
  passengerToken = await signup('passenger', PASSENGER_EMAIL);
  otherPassengerToken = await signup('passenger', OTHER_PASSENGER_EMAIL);

  const vehicleRes = await request(app)
    .post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${driverToken}`)
    .send({ name: 'Bullet', model: 'Model 3', plate_number: PLATE, capacity: 3 });
  vehicleId = vehicleRes.body.data.vehicle.id;

  const rideRes = await request(app)
    .post('/api/v1/rides')
    .set('Authorization', `Bearer ${passengerToken}`)
    .send({ pickup_zone_id: banani.id, destination_zone_id: mohakhali.id, seats_requested: 1 });
  completedRideId = rideRes.body.data.ride.id;

  const poolRes = await request(app)
    .post('/api/v1/pools')
    .set('Authorization', `Bearer ${driverToken}`)
    .send({ vehicle_id: vehicleId, ride_request_id: completedRideId });
  const poolId = poolRes.body.data.pool.id;

  await request(app).patch(`/api/v1/pools/${poolId}/accept`).set('Authorization', `Bearer ${driverToken}`);
  await request(app).patch(`/api/v1/pools/${poolId}/arrived`).set('Authorization', `Bearer ${driverToken}`);
  await request(app).patch(`/api/v1/pools/${poolId}/start`).set('Authorization', `Bearer ${driverToken}`);
  await request(app).patch(`/api/v1/pools/${poolId}/complete`).set('Authorization', `Bearer ${driverToken}`);
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Payments', () => {
  it('rejects paying for a ride that is not completed', async () => {
    const rideRes = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ pickup_zone_id: banani.id, destination_zone_id: mohakhali.id, seats_requested: 1 });

    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ ride_request_id: rideRes.body.data.ride.id, method: 'cash' });

    expect(res.statusCode).toBe(400);
  });

  it('blocks a different passenger from paying for someone else\'s ride', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${otherPassengerToken}`)
      .send({ ride_request_id: completedRideId, method: 'cash' });

    expect(res.statusCode).toBe(403);
  });

  it('records a payment for a completed ride with the correct amount', async () => {
    const ride = await prisma.ride_requests.findUnique({ where: { id: completedRideId } });

    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ ride_request_id: completedRideId, method: 'teslapay' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.payment.status).toBe('paid');
    expect(res.body.data.payment.amount_paisa).toBe(ride.final_fare_paisa.toString());
  });

  it('rejects a duplicate payment for the same ride', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ ride_request_id: completedRideId, method: 'cash' });

    expect(res.statusCode).toBe(409);
  });

  it('lets the passenger fetch their payment', async () => {
    const res = await request(app)
      .get(`/api/v1/payments/ride/${completedRideId}`)
      .set('Authorization', `Bearer ${passengerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.payment.method).toBe('teslapay');
  });

  it('blocks a different passenger from viewing the payment', async () => {
    const res = await request(app)
      .get(`/api/v1/payments/ride/${completedRideId}`)
      .set('Authorization', `Bearer ${otherPassengerToken}`);

    expect(res.statusCode).toBe(403);
  });
});