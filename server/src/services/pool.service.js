const POOL_TRANSITIONS = {
  open: ['accepted', 'cancelled'],
  accepted: ['driver_arrived', 'cancelled'],
  driver_arrived: ['started', 'cancelled'],
  started: ['completed'],
  completed: [],
  cancelled: [],
};
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const vehicleService = require('./vehicle.service');
const fareService = require('./fare.service');

// MATCHING RULE (documented per Section 4 of the brief):
// Two ride requests are poolable together if they share the same pickup
// zone. Destinations do NOT need to match - the vehicle drops each rider
// at their own stop, same as Nusrat (Banani->Mohakhali) and Rafiq
// (Banani->Gulshan1) in the brief's own story.

async function assertVehicleReady(vehicleId, driverId) {
  const vehicle = await vehicleService.getVehicleByIdForDriver(vehicleId, driverId);
  if (vehicle.status !== 'active') {
    throw new ApiError(400, 'Vehicle must be active to start a pool');
  }
  return vehicle;
}

async function getMatchableRideRequest(rideRequestId) {
  const ride = await prisma.ride_requests.findUnique({ where: { id: rideRequestId } });
  if (!ride) throw new ApiError(404, 'Ride request not found');
  if (ride.status !== 'requested') {
    throw new ApiError(400, `Ride request is already '${ride.status}', not available to match`);
  }
  return ride;
}

async function getPoolOwnedByDriver(poolId, driverId) {
  const pool = await prisma.pools.findUnique({ where: { id: poolId } });
  if (!pool) throw new ApiError(404, 'Pool not found');

  const vehicle = await prisma.vehicles.findUnique({ where: { id: pool.vehicle_id } });
  if (!vehicle || vehicle.driver_id !== driverId) {
    throw new ApiError(403, 'You do not own the vehicle for this pool');
  }

  return pool;
}

// Recomputes every active member's fare together whenever the pool's
// membership changes, so pooling fairness never depends on join order.
async function recalculateFaresForPool(poolId) {
  const activeMembers = await prisma.pool_members.findMany({
    where: { pool_id: poolId, status: 'active' },
  });

  const isPooled = activeMembers.length > 1;

  for (const member of activeMembers) {
    const ride = await prisma.ride_requests.findUnique({ where: { id: member.ride_request_id } });
    const fare = fareService.calculateFare({
      distanceKm: Number(ride.estimated_distance_km),
      seatsRequested: ride.seats_requested,
      isPooled,
    });

    await prisma.pool_members.update({
      where: { id: member.id },
      data: { agreed_fare_paisa: fare.totalFarePaisa },
    });
    // sync_ride_final_fare_trigger propagates this into
    // ride_requests.final_fare_paisa automatically.
  }
}

async function createPool(driverId, { vehicle_id, ride_request_id, seats_allocated }) {
  const vehicle = await assertVehicleReady(vehicle_id, driverId);
  const ride = await getMatchableRideRequest(ride_request_id);

  const seats = seats_allocated ?? ride.seats_requested;

  const pool = await prisma.pools.create({
    data: {
      vehicle_id: vehicle.id,
      capacity_snapshot: vehicle.capacity,
      status: 'open',
    },
  });

  const fare = fareService.calculateFare({
    distanceKm: Number(ride.estimated_distance_km),
    seatsRequested: ride.seats_requested,
    isPooled: false, // sole member so far
  });

  await prisma.pool_members.create({
    data: {
      pool_id: pool.id,
      ride_request_id: ride.id,
      seats_allocated: seats,
      agreed_fare_paisa: fare.totalFarePaisa,
    },
  });
  // mark_ride_matched_on_pool_join_trigger auto-advances the ride to
  // 'matched' the instant this insert commits.

  return pool;
}

async function joinPool(driverId, poolId, { ride_request_id, seats_allocated }) {
  const pool = await getPoolOwnedByDriver(poolId, driverId);

  if (pool.status !== 'open') {
    throw new ApiError(400, `Cannot join a pool that is '${pool.status}'`);
  }

  const newRide = await getMatchableRideRequest(ride_request_id);

  const existingMember = await prisma.pool_members.findFirst({
    where: { pool_id: poolId, status: 'active' },
  });
  if (existingMember) {
    const existingRide = await prisma.ride_requests.findUnique({
      where: { id: existingMember.ride_request_id },
    });
    if (existingRide.pickup_zone_id !== newRide.pickup_zone_id) {
      throw new ApiError(
        400,
        'This ride cannot join the pool: pickup zone does not match the existing passengers'
      );
    }
  }

  const seats = seats_allocated ?? newRide.seats_requested;

  // The database's capacity trigger (row-locked) is what actually makes
  // this safe under concurrency - if two joins race for the last seat,
  // only one INSERT here succeeds; the other gets a Postgres exception
  // that the error middleware turns into a clean 400.
  await prisma.pool_members.create({
    data: {
      pool_id: poolId,
      ride_request_id: newRide.id,
      seats_allocated: seats,
      agreed_fare_paisa: 0, // placeholder, recalculated immediately below
    },
  });

  await recalculateFaresForPool(poolId);

  return prisma.pools.findUnique({ where: { id: poolId } });
}

async function transitionPool(driverId, poolId, newStatus) {
  const pool = await getPoolOwnedByDriver(poolId, driverId);

  const allowed = POOL_TRANSITIONS[pool.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(400, `Cannot move pool from '${pool.status}' to '${newStatus}'`);
  }

  return prisma.pools.update({
    where: { id: poolId },
    data: { status: newStatus },
  });
}

const acceptPool = (driverId, poolId) => transitionPool(driverId, poolId, 'accepted');
const markDriverArrived = (driverId, poolId) => transitionPool(driverId, poolId, 'driver_arrived');
const startPool = (driverId, poolId) => transitionPool(driverId, poolId, 'started');
const completePool = (driverId, poolId) => transitionPool(driverId, poolId, 'completed');
const cancelPool = (driverId, poolId) => transitionPool(driverId, poolId, 'cancelled');

async function listAvailableRequests(pickupZoneId) {
  return prisma.ride_requests.findMany({
    where: {
      status: 'requested',
      ...(pickupZoneId ? { pickup_zone_id: pickupZoneId } : {}),
    },
    orderBy: { requested_at: 'asc' },
  });
}

async function listPoolsForDriver(driverId) {
  const vehicles = await prisma.vehicles.findMany({ where: { driver_id: driverId } });
  const vehicleIds = vehicles.map((v) => v.id);
  if (!vehicleIds.length) return [];
  return prisma.pools.findMany({
    where: { vehicle_id: { in: vehicleIds } },
    orderBy: { created_at: 'desc' },
  });
}

async function getPoolDetail(driverId, poolId) {
  const pool = await getPoolOwnedByDriver(poolId, driverId);
  const members = await prisma.pool_members.findMany({ where: { pool_id: poolId } });

  const memberDetails = await Promise.all(
    members.map(async (m) => {
      const ride = await prisma.ride_requests.findUnique({ where: { id: m.ride_request_id } });
      const passenger = await prisma.users.findUnique({ where: { id: ride.passenger_id } });
      return {
        pool_member_id: m.id,
        status: m.status,
        seats_allocated: m.seats_allocated,
        agreed_fare_paisa: m.agreed_fare_paisa,
        ride_request_id: ride.id,
        ride_status: ride.status,
        pickup_zone_id: ride.pickup_zone_id,
        destination_zone_id: ride.destination_zone_id,
        passenger_name: passenger.full_name,
      };
    })
  );

  return { pool, members: memberDetails };
}

async function listPoolsForDriverDetailed(driverId) {
  const pools = await listPoolsForDriver(driverId);
  return Promise.all(pools.map((p) => getPoolDetail(driverId, p.id)));
}

module.exports = {
  createPool,
  joinPool,
  acceptPool,
  markDriverArrived,
  startPool,
  completePool,
  cancelPool,
  listAvailableRequests,
  listPoolsForDriver,
  listPoolsForDriverDetailed,
  getPoolDetail,
};