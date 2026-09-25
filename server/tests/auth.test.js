const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const TEST_EMAIL = 'test.passenger.auth@dhakateslapool.test';
const TEST_PASSWORD = 'password123';

async function cleanup() {
  await prisma.users.deleteMany({ where: { email: TEST_EMAIL } });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Passenger auth', () => {
  it('signs up a new passenger', async () => {
    const res = await request(app).post('/api/v1/auth/passenger/signup').send({
      full_name: 'Test Passenger',
      email: TEST_EMAIL,
      phone: '+8801700000099',
      password: TEST_PASSWORD,
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('rejects signup with a duplicate email', async () => {
    const res = await request(app).post('/api/v1/auth/passenger/signup').send({
      full_name: 'Duplicate Attempt',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects signup with invalid input', async () => {
    const res = await request(app).post('/api/v1/auth/passenger/signup').send({
      full_name: 'A',
      email: 'not-an-email',
      password: '123',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/v1/auth/passenger/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/passenger/login').send({
      email: TEST_EMAIL,
      password: 'wrong-password',
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('returns the current user with a valid token', async () => {
    const login = await request(app).post('/api/v1/auth/passenger/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const { token } = login.body.data;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
  });
});