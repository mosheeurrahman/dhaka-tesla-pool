const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

// Cast: Rafiq holds 2 of Bullet's 3 seats. Nusrat and Shirin then race for the last one.
const EMAILS = {
  driver: 'test.capacity.jashim@dhakateslapool.test',
  rafiq: 'test.capacity.rafiq@dhakateslapool.test',
  nusrat: 'test.capacity.nusrat@dhakateslapool.test',
  shirin: 'test.capacity.shirin@dhakateslapool.test',
};
const PASSWORD = 'password123';

const tokens = {};
const zones = {};
let founderPoolId;

async function cleanup() {
  const users = await prisma.users.findMany({ where: { email: { in: Object.values(EMAILS) } } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const rides = await prisma.ride_requests.findMany({ where: { passenger_id: { in: ids } } });
    const rideIds = rides.map((r) => r.id);
    const memberships = await prisma.pool_members.findMany({ where: { ride_request_id: { in: rideIds } } });
    const poolIds = [...new Set(memberships.map((m) => m.pool_id))];
    await prisma.pool_members.deleteMany({ where: { ride_request_id: { in: rideIds } } });
    await prisma.ride_status_history.deleteMany({ where: { ride_request_id: { in: rideIds } } });
    await prisma.ride_requests.deleteMany({ where: { id: { in: rideIds } } });
    await prisma.pools.deleteMany({ where: { id: { in: poolIds } } });
    await prisma.vehicles.deleteMany({ where: { driver_id: { in: ids } } });
  }
  await prisma.users.deleteMany({ where: { email: { in: Object.values(EMAILS) } } });
}

async function signup(role, email) {
  const res = await request(app)
    .post(`/api/v1/auth/${role}/signup`)
    .send({ full_name: `Capacity ${role}`, email, password: PASSWORD });
  return res.body.data.token;
}

function requestRide(token, pickup, destination, seats = 1) {
  return request(app)
    .post('/api/v1/rides')
    .set('Authorization', `Bearer ${token}`)
    .send({ pickup_zone_id: pickup.id, destination_zone_id: destination.id, seats_requested: seats });
}

beforeAll(async () => {
  await cleanup();
  for (const code of ['MOHAKHALI', 'GULSHAN1', 'GULSHAN2']) {
    zones[code] = await prisma.zones.findUnique({ where: { code } });
  }
  tokens.driver = await signup('driver', EMAILS.driver);
  tokens.rafiq = await signup('passenger', EMAILS.rafiq);
  tokens.nusrat = await signup('passenger', EMAILS.nusrat);
  tokens.shirin = await signup('passenger', EMAILS.shirin);

  await request(app)
    .post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${tokens.driver}`)
    .send({ name: 'Bullet', model: 'Model 3', plate_number: 'TEST-CAPACITY-01', capacity: 3 });
  await request(app)
    .patch('/api/v1/drivers/status')
    .set('Authorization', `Bearer ${tokens.driver}`)
    .send({ is_online: true });

  const founder = await requestRide(tokens.rafiq, zones.MOHAKHALI, zones.GULSHAN1, 2);
  const membership = await prisma.pool_members.findFirst({
    where: { ride_request_id: founder.body.data.ride.id },
  });
  founderPoolId = membership.pool_id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Seat capacity under concurrency (last-seat race)', () => {
  it('never lets a group pass 3 seats when Nusrat and Shirin race for the last one', async () => {
    const [nusrat, shirin] = await Promise.all([
      requestRide(tokens.nusrat, zones.GULSHAN1, zones.GULSHAN2),
      requestRide(tokens.shirin, zones.GULSHAN1, zones.GULSHAN2),
    ]);
    expect(nusrat.statusCode).toBe(201);
    expect(shirin.statusCode).toBe(201);

    const seated = await prisma.pool_members.findMany({
      where: { pool_id: founderPoolId, status: 'active' },
    });
    expect(seated.reduce((sum, m) => sum + m.seats_allocated, 0)).toBe(3); // never 4

    const memberships = await prisma.pool_members.findMany({
      where: { ride_request_id: { in: [nusrat.body.data.ride.id, shirin.body.data.ride.id] } },
    });
    expect(memberships).toHaveLength(2); // nobody was dropped
    expect(memberships.filter((m) => m.pool_id === founderPoolId)).toHaveLength(1); // exactly one won
  });
});

describe('Pool state transitions', () => {
  it('rejects an illegal jump (accepted -> completed)', async () => {
    const accept = await request(app)
      .patch(`/api/v1/pools/${founderPoolId}/accept`)
      .set('Authorization', `Bearer ${tokens.driver}`);
    expect(accept.statusCode).toBe(200);

    const complete = await request(app)
      .patch(`/api/v1/pools/${founderPoolId}/complete`)
      .set('Authorization', `Bearer ${tokens.driver}`);
    expect(complete.statusCode).toBe(400);
  });
});