const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const DRIVER_EMAIL = 'test.driver.auth@dhakateslapool.test';
const PASSENGER_EMAIL = 'test.passenger.fordrivercheck@dhakateslapool.test';
const PASSWORD = 'oi_mama_jaben@123';

async function cleanup() {
  await prisma.users.deleteMany({
    where: { email: { in: [DRIVER_EMAIL, PASSENGER_EMAIL] } },
  });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Driver auth', () => {
  let driverToken;

  it('signs up a new driver', async () => {
    const res = await request(app).post('/api/v1/auth/driver/signup').send({
      full_name: 'Test Driver',
      email: DRIVER_EMAIL,
      phone: '+8801700000098',
      password: PASSWORD,
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.user.role).toBe('driver');
    expect(res.body.data.user.is_online).toBe(false);
    driverToken = res.body.data.token;
  });

  it('logs in as the driver', async () => {
    const res = await request(app).post('/api/v1/auth/driver/login').send({
      email: DRIVER_EMAIL,
      password: PASSWORD,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.role).toBe('driver');
  });

  it('rejects a passenger account trying to log in through the driver endpoint', async () => {
    await request(app).post('/api/v1/auth/passenger/signup').send({
      full_name: 'Passenger For Check',
      email: PASSENGER_EMAIL,
      password: PASSWORD,
    });

    const res = await request(app).post('/api/v1/auth/driver/login').send({
      email: PASSENGER_EMAIL,
      password: PASSWORD,
    });

    expect(res.statusCode).toBe(401);
  });

  it('toggles driver online status', async () => {
    const res = await request(app)
      .patch('/api/v1/drivers/status')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ is_online: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.driver.is_online).toBe(true);
  });

  it('gets driver profile reflecting the updated status', async () => {
    const res = await request(app)
      .get('/api/v1/drivers/me')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.driver.is_online).toBe(true);
  });

  it('rejects a passenger token from accessing driver-only routes', async () => {
    const passengerLogin = await request(app).post('/api/v1/auth/passenger/login').send({
      email: PASSENGER_EMAIL,
      password: PASSWORD,
    });
    const passengerToken = passengerLogin.body.data.token;

    const res = await request(app)
      .patch('/api/v1/drivers/status')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ is_online: true });

    expect(res.statusCode).toBe(403);
  });
});