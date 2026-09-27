const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const DRIVER_ONE_EMAIL = 'test.accept.driver1@dhakateslapool.test';
const DRIVER_TWO_EMAIL = 'test.accept.driver2@dhakateslapool.test';
const PASSENGER_EMAIL = 'test.accept.passenger@dhakateslapool.test';
const PASSWORD = 'password123';

let driverOneToken, driverTwoToken, passengerToken;
let mohakhali, gulshan1;

async function cleanup() {
  const emails = [DRIVER_ONE_EMAIL, DRIVER_TWO_EMAIL, PASSENGER_EMAIL];
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
  const res = await request(app).post(`/api/v1/auth/${role}/signup`).send({ full_name: `Test ${role}`, email, password: PASSWORD });
  return res.body.data.token;
}

beforeAll(async () => {
  await cleanup();
  mohakhali = await prisma.zones.findUnique({ where: { code: 'MOHAKHALI' } });
  gulshan1 = await prisma.zones.findUnique({ where: { code: 'GULSHAN1' } });
  driverOneToken = await signup('driver', DRIVER_ONE_EMAIL);
  driverTwoToken = await signup('driver', DRIVER_TWO_EMAIL);
  passengerToken = await signup('passenger', PASSENGER_EMAIL);

  await request(app).post('/api/v1/vehicles').set('Authorization', `Bearer ${driverOneToken}`).send({ name: 'Bullet1', model: 'Model 3', plate_number: 'TEST-D1', capacity: 3 });
  await request(app).post('/api/v1/vehicles').set('Authorization', `Bearer ${driverTwoToken}`).send({ name: 'Bullet2', model: 'Model 3', plate_number: 'TEST-D2', capacity: 3 });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Open ride requests: visible to all drivers, locked only on accept', () => {
  let poolId;

  it('creates an unassigned pool visible to any driver, without needing anyone online', async () => {
    const rideRes = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ pickup_zone_id: mohakhali.id, destination_zone_id: gulshan1.id });
    expect(rideRes.statusCode).toBe(201);
    const rideId = rideRes.body.data.ride.id;

    const listAsDriverOne = await request(app).get('/api/v1/pools/open').set('Authorization', `Bearer ${driverOneToken}`);
    const listAsDriverTwo = await request(app).get('/api/v1/pools/open').set('Authorization', `Bearer ${driverTwoToken}`);

    const matchOne = listAsDriverOne.body.data.pools.find((p) => p.members.some((m) => m.ride_request_id === rideId));
    const matchTwo = listAsDriverTwo.body.data.pools.find((p) => p.members.some((m) => m.ride_request_id === rideId));

    expect(matchOne).toBeDefined();
    expect(matchTwo).toBeDefined();
    poolId = matchOne.pool.id;
  });

  it('lets driver two accept it after driver one only viewed it', async () => {
    const res = await request(app).patch(`/api/v1/pools/${poolId}/accept`).set('Authorization', `Bearer ${driverTwoToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.pool.status).toBe('accepted');
  });

  it('removes the pool from the open list for driver one once accepted', async () => {
    const res = await request(app).get('/api/v1/pools/open').set('Authorization', `Bearer ${driverOneToken}`);
    expect(res.body.data.pools.find((p) => p.pool.id === poolId)).toBeUndefined();
  });

  it('rejects driver one trying to accept the same pool afterward', async () => {
    const res = await request(app).patch(`/api/v1/pools/${poolId}/accept`).set('Authorization', `Bearer ${driverOneToken}`);
    expect(res.statusCode).toBe(409);
  });
  it('never combines two rides whose paths fork in different directions', async () => {
    const mohammadpur = await prisma.zones.findUnique({ where: { code: 'MOHAMMADPUR' } });
    const dhanmondi = await prisma.zones.findUnique({ where: { code: 'DHAHANMANDI' } });
    const bracu = await prisma.zones.findUnique({ where: { code: 'BRACU' } });

    const rideA = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ pickup_zone_id: mohammadpur.id, destination_zone_id: bracu.id });

    const rideB = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ pickup_zone_id: dhanmondi.id, destination_zone_id: bracu.id });

    const openList = await request(app).get('/api/v1/pools/open').set('Authorization', `Bearer ${driverOneToken}`);
    const poolA = openList.body.data.pools.find((p) => p.members.some((m) => m.ride_request_id === rideA.body.data.ride.id));
    const poolB = openList.body.data.pools.find((p) => p.members.some((m) => m.ride_request_id === rideB.body.data.ride.id));

    expect(poolA.pool.id).not.toBe(poolB.pool.id); // must be two SEPARATE pools, not merged
  });
});