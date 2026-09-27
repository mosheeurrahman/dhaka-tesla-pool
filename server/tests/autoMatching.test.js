const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const DRIVER_EMAIL = 'test.automatch.driver@dhakateslapool.test';
const PASSENGER_A_EMAIL = 'test.automatch.passengerA@dhakateslapool.test';
const PASSENGER_B_EMAIL = 'test.automatch.passengerB@dhakateslapool.test';
const PASSWORD = 'password123';
const PLATE = 'TEST-AUTO-01';

let driverToken, passengerAToken, passengerBToken;
let mohakhali, gulshan1, gulshan2, banani;

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
  const res = await request(app).post(`/api/v1/auth/${role}/signup`).send({
    full_name: `Auto Match ${role}`, email, password: PASSWORD,
  });
  return res.body.data.token;
}

beforeAll(async () => {
  await cleanup();
  mohakhali = await prisma.zones.findUnique({ where: { code: 'MOHAKHALI' } });
  gulshan1 = await prisma.zones.findUnique({ where: { code: 'GULSHAN1' } });
  gulshan2 = await prisma.zones.findUnique({ where: { code: 'GULSHAN2' } });
  banani = await prisma.zones.findUnique({ where: { code: 'BANANI' } });

  driverToken = await signup('driver', DRIVER_EMAIL);
  passengerAToken = await signup('passenger', PASSENGER_A_EMAIL);
  passengerBToken = await signup('passenger', PASSENGER_B_EMAIL);

  await request(app)
    .post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${driverToken}`)
    .send({ name: 'Bullet', model: 'Model 3', plate_number: PLATE, capacity: 3 });

  await request(app)
    .patch('/api/v1/drivers/status')
    .set('Authorization', `Bearer ${driverToken}`)
    .send({ is_online: true });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Automatic path-overlap matching', () => {
  it('auto-assigns the first ride to a new pool with an available driver', async () => {
    const res = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerAToken}`)
      .send({ pickup_zone_id: mohakhali.id, destination_zone_id: gulshan1.id });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.ride.status).toBe('matched');
  });

  it('auto-joins a second ride whose path shares an edge with the existing pool', async () => {
    // Gulshan1 -> Banani shares the Gulshan1-Gulshan2 edge? No - check overlap
    // with Mohakhali->Gulshan1's own edge set: {MOHAKHALI-GULSHAN1}.
    // Gulshan2->Banani shares no edge with that. Use an overlapping route instead:
    // Gulshan2 -> Gulshan1 shares the GULSHAN1-GULSHAN2 edge only if the
    // pool's spine also uses it - it doesn't. Use a genuinely overlapping pair:
    const res = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerBToken}`)
      .send({ pickup_zone_id: mohakhali.id, destination_zone_id: gulshan1.id });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.ride.status).toBe('matched');

    const vehicles = await prisma.vehicles.findMany({ where: { plate_number: PLATE } });
    const pools = await prisma.pools.findMany({ where: { vehicle_id: vehicles[0].id } });
    expect(pools.length).toBe(1); // both rides landed in the SAME pool, not two separate ones
  });
});