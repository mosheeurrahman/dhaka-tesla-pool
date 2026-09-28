const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');

const DEMO_PASSWORD = 'oi_mama_jaben@123';

async function main() {
  console.log('Seeding Dhaka Tesla Pool demo data...');

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  // --- Zones (upsert: safe to re-run, won't duplicate) ---
  const zoneSeed = [
    { code: 'UTTARA', name: 'Uttara', latitude: 3, longitude: 11.5 },
    { code: 'MIRPUR10', name: 'Mirpur 10', latitude: 2.5, longitude: 6.2 },
    { code: 'MOHAMMADPUR', name: 'Mohammadpur', latitude: 0.5, longitude: 2.5 },
    { code: 'DHAHANMANDI', name: 'Dhanmondi', latitude: 2.5, longitude: 0.5 },
    { code: 'FARMGATE', name: 'Farmgate', latitude: 5, longitude: 1.5 },
    { code: 'BRACU', name: 'BRAC University', latitude: 11.5, longitude: 2 },
    { code: 'GULSHAN1', name: 'Gulshan 1', latitude: 10.5, longitude: 3 },
    { code: 'GULSHAN2', name: 'Gulshan 2', latitude: 11, longitude: 4 },
    { code: 'BANANI', name: 'Banani', latitude: 9, longitude: 5.5 },
    { code: 'MOHAKHALI', name: 'Mohakhali', latitude: 9, longitude: 3.5 },
  ];

  await prisma.zones.deleteMany({ where: { code: 'DHAKA_UNIVERSITY' } });

  const zones = {};
  for (const z of zoneSeed) {
    const zone = await prisma.zones.upsert({
      where: { code: z.code },
      update: { name: z.name, latitude: z.latitude, longitude: z.longitude },
      create: z,
    });
    zones[z.code] = zone;
  }
  console.log(`  Zones ready: ${Object.keys(zones).length}`);

  // --- Wipe transactional/demo data for a clean, repeatable seed ---
  // (children first, respecting foreign keys)
  await prisma.payments.deleteMany({});
  await prisma.pool_members.deleteMany({});
  await prisma.ride_status_history.deleteMany({});
  await prisma.pools.deleteMany({});
  await prisma.ride_requests.deleteMany({});
  await prisma.vehicles.deleteMany({});
  await prisma.users.deleteMany({});
  console.log('  Cleared previous demo transactional data');

  // --- Story cast: drivers ---
  const jashim = await prisma.users.create({
    data: {
      full_name: 'Jashim Uddin',
      email: 'jashim@dhakateslapool.test',
      phone: '+8801710000001',
      password_hash: passwordHash,
      role: 'driver',
    },
  });

  const kuddus = await prisma.users.create({
    data: {
      full_name: 'Kuddus',
      email: 'kuddus@dhakateslapool.test',
      phone: '+8801710000006',
      password_hash: passwordHash,
      role: 'driver',
    },
  });

  // --- Story cast: passengers ---
  const nusrat = await prisma.users.create({
    data: {
      full_name: 'Nusrat Jahan',
      email: 'nusrat@dhakateslapool.test',
      phone: '+8801710000002',
      password_hash: passwordHash,
      role: 'passenger',
    },
  });

  const rafiq = await prisma.users.create({
    data: {
      full_name: 'Rafiq Hasan',
      email: 'rafiq@dhakateslapool.test',
      phone: '+8801710000003',
      password_hash: passwordHash,
      role: 'passenger',
    },
  });

  const shirin = await prisma.users.create({
    data: {
      full_name: 'Shirin Akter',
      email: 'shirin@dhakateslapool.test',
      phone: '+8801710000004',
      password_hash: passwordHash,
      role: 'passenger',
    },
  });

  const mosheeur = await prisma.users.create({
    data: {
      full_name: 'Moshee-Ur',
      email: 'mosheeur@dhakateslapool.test',
      phone: '+8801710000007',
      password_hash: passwordHash,
      role: 'passenger',
    },
  });

  const mehek = await prisma.users.create({
    data: {
      full_name: 'Mehek',
      email: 'mehek@dhakateslapool.test',
      phone: '+8801710000008',
      password_hash: passwordHash,
      role: 'passenger',
    },
  });

  const alice = await prisma.users.create({
    data: {
      full_name: 'Alice',
      email: 'alice@dhakateslapool.test',
      phone: '+8801710000009',
      password_hash: passwordHash,
      role: 'passenger',
    },
  });

  console.log('  Users ready: Jashim, Kuddus (drivers), Nusrat, Rafiq, Shirin, Moshee-Ur, Mehek, Alice (passengers)');

  // --- Story cast: vehicles ---
  await prisma.vehicles.create({
    data: {
      driver_id: jashim.id,
      name: 'Bullet',
      make: 'Tesla',
      model: 'Model 3 (unofficial)',
      plate_number: 'DHAKA-TESLA-01',
      capacity: 3,
      status: 'active',
    },
  });
  console.log('  Vehicle ready: Bullet (Jashim)');

  await prisma.vehicles.create({
    data: {
      driver_id: kuddus.id,
      name: 'Thunder',
      make: 'Tesla',
      model: 'Model Y (unofficial)',
      plate_number: 'DHAKA-TESLA-02',
      capacity: 3,
      status: 'active',
    },
  });
  console.log('  Vehicle ready: Thunder (Kuddus)');

  console.log('\nSeed complete. Demo login password for all users: ' + DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });