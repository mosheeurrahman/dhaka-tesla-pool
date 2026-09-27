const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const DRIVER_ONE_EMAIL = 'test.vehicle.driver1@dhakateslapool.test';
const DRIVER_TWO_EMAIL = 'test.vehicle.driver2@dhakateslapool.test';
const PASSENGER_EMAIL = 'test.vehicle.passenger@dhakateslapool.test';
const PASSWORD = 'oi_mama_jaben@123';
const PLATE = 'TEST-BULLET-99';

async function cleanup() {
  await prisma.vehicles.deleteMany({ where: { plate_number: PLATE } });
  await prisma.users.deleteMany({
    where: { email: { in: [DRIVER_ONE_EMAIL, DRIVER_TWO_EMAIL, PASSENGER_EMAIL] } },
  });
}

let driverOneToken;
let driverTwoToken;
let passengerToken;
let createdVehicleId;

beforeAll(async () => {
  await cleanup();

  const d1 = await request(app).post('/api/v1/auth/driver/signup').send({
    full_name: 'Vehicle Test Driver One',
    email: DRIVER_ONE_EMAIL,
    password: PASSWORD,
  });
  driverOneToken = d1.body.data.token;

  const d2 = await request(app).post('/api/v1/auth/driver/signup').send({
    full_name: 'Vehicle Test Driver Two',
    email: DRIVER_TWO_EMAIL,
    password: PASSWORD,
  });
  driverTwoToken = d2.body.data.token;

  const p1 = await request(app).post('/api/v1/auth/passenger/signup').send({
    full_name: 'Vehicle Test Passenger',
    email: PASSENGER_EMAIL,
    password: PASSWORD,
  });
  passengerToken = p1.body.data.token;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Vehicle management', () => {
  it('lets a driver create a vehicle', async () => {
    const res = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${driverOneToken}`)
      .send({ name: 'Bullet', model: 'Model 3', plate_number: PLATE, capacity: 3 });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.vehicle.driver_id).toBeDefined();
    expect(res.body.data.vehicle.capacity).toBe(3);
    createdVehicleId = res.body.data.vehicle.id;
  });

  it('rejects a duplicate plate number', async () => {
    const res = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${driverTwoToken}`)
      .send({ name: 'Copycat', model: 'Model 3', plate_number: PLATE, capacity: 3 });

    expect(res.statusCode).toBe(409);
  });

  it('rejects capacity outside 1-3', async () => {
    const res = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${driverOneToken}`)
      .send({ name: 'Too Big', model: 'Van', plate_number: 'TEST-BAD-1', capacity: 5 });

    expect(res.statusCode).toBe(400);
  });

  it('rejects a passenger trying to create a vehicle', async () => {
    const res = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ name: 'Nope', model: 'Model 3', plate_number: 'TEST-BAD-2', capacity: 3 });

    expect(res.statusCode).toBe(403);
  });

  it("lists the owning driver's vehicles", async () => {
    const res = await request(app)
      .get('/api/v1/vehicles/me')
      .set('Authorization', `Bearer ${driverOneToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.vehicles.length).toBeGreaterThanOrEqual(1);
  });

  it('lets the owner fetch the vehicle by id', async () => {
    const res = await request(app)
      .get(`/api/v1/vehicles/${createdVehicleId}`)
      .set('Authorization', `Bearer ${driverOneToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.vehicle.id).toBe(createdVehicleId);
  });

  it('blocks a different driver from fetching someone else\'s vehicle', async () => {
    const res = await request(app)
      .get(`/api/v1/vehicles/${createdVehicleId}`)
      .set('Authorization', `Bearer ${driverTwoToken}`);

    expect(res.statusCode).toBe(403);
  });

  it('lets the owner update capacity', async () => {
    const res = await request(app)
      .patch(`/api/v1/vehicles/${createdVehicleId}`)
      .set('Authorization', `Bearer ${driverOneToken}`)
      .send({ capacity: 2 });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.vehicle.capacity).toBe(2);
  });

  it('blocks a different driver from updating the vehicle', async () => {
    const res = await request(app)
      .patch(`/api/v1/vehicles/${createdVehicleId}`)
      .set('Authorization', `Bearer ${driverTwoToken}`)
      .send({ capacity: 1 });

    expect(res.statusCode).toBe(403);
  });
});