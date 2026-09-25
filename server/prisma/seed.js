const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');

const DEMO_PASSWORD = 'password123';

async function main() {
  console.log('Seeding Dhaka Tesla Pool demo data...');

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  // --- Zones (upsert: safe to re-run, won't duplicate) ---
  const zoneSeed = [
    { code: 'BANANI', name: 'Banani' },
    { code: 'MOHAKHALI', name: 'Mohakhali' },
    { code: 'GULSHAN1', name: 'Gulshan 1' },
    { code: 'GULSHAN2', name: 'Gulshan 2' },
    { code: 'BRACU', name: 'BRAC University' },
    { code: 'DHAHANMANDI', name: 'Dhanmondi' },
    { code: 'UTTARA', name: 'Uttara' },
    { code: 'FARMGATE', name: 'Farmgate' },
    { code: 'MIRPUR10', name: 'Mirpur 10' },
    { code: 'MOHAMMADPUR', name: 'Mohammadpur' },
  ];

  const zones = {};
  for (const z of zoneSeed) {
    const zone = await prisma.zones.upsert({
      where: { code: z.code },
      update: { name: z.name },
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
  await prisma.zones.deleteMany({ where: { code: 'DHAKA_UNIVERSITY' } });
  console.log('  Cleared previous demo transactional data');

  // --- Story cast: driver ---
  const jashim = await prisma.users.create({
    data: {
      full_name: 'Jashim Uddin',
      email: 'jashim@dhakateslapool.test',
      phone: '+8801710000001',
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

  console.log('  Users ready: Jashim (driver), Nusrat, Rafiq, Shirin (passengers)');

  // --- Jashim's Tesla ---
  const bullet = await prisma.vehicles.create({
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
  console.log(`  Vehicle ready: ${bullet.name} (capacity ${bullet.capacity})`);

  // --- Sample ride requests matching the brief's Banani rush-hour story ---
  // Nusrat: Banani -> Mohakhali
  const nusratRide = await prisma.ride_requests.create({
    data: {
      passenger_id: nusrat.id,
      pickup_zone_id: zones.BANANI.id,
      destination_zone_id: zones.MOHAKHALI.id,
      seats_requested: 1,
      estimated_distance_km: 3.2,
      estimated_fare_paisa: 8000, // 80.00 BDT, in paisa
      status: 'requested',
    },
  });

  // Rafiq: Banani -> Gulshan 1 (overlapping-but-not-identical route)
  const rafiqRide = await prisma.ride_requests.create({
    data: {
      passenger_id: rafiq.id,
      pickup_zone_id: zones.BANANI.id,
      destination_zone_id: zones.GULSHAN1.id,
      seats_requested: 1,
      estimated_distance_km: 2.1,
      estimated_fare_paisa: 6000, // 60.00 BDT, in paisa
      status: 'requested',
    },
  });

  console.log('  Ride requests ready: Nusrat (Banani->Mohakhali), Rafiq (Banani->Gulshan1)');
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