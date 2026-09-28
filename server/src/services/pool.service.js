const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const fareService = require('./fare.service');
const dhakaGraph = require('../data/dhakaGraph');

const UNASSIGNED_CAPACITY = 3;

async function getRidePath(ride) {
  const pickup = await prisma.zones.findUnique({ where: { id: ride.pickup_zone_id } });
  const destination = await prisma.zones.findUnique({ where: { id: ride.destination_zone_id } });
  return dhakaGraph.shortestPath(pickup.code, destination.code);
}

async function recalculateFaresForPool(poolId) {
  const activeMembers = await prisma.pool_members.findMany({ where: { pool_id: poolId, status: 'active' } });
  const isPooled = activeMembers.length > 1;

  for (const member of activeMembers) {
    const ride = await prisma.ride_requests.findUnique({ where: { id: member.ride_request_id } });
    const route = await getRidePath(ride);
    const fare = fareService.calculateFare({
      distanceKm: route.distanceKm,
      seatsRequested: ride.seats_requested,
      isPooled,
    });
    await prisma.pool_members.update({
      where: { id: member.id },
      data: { agreed_fare_paisa: fare.totalFarePaisa },
    });
  }
}

// The database trigger is the referee for seats. If we lose a race for the
// last seat, that is not an error for the rider: try the next group instead.
function isSeatConflict(err) {
  const text = `${err?.message || ''} ${err?.meta?.driverAdapterError?.message || ''}`;
  return text.includes('Pool capacity exceeded') || text.includes('not open');
}

// MATCHING RULE: passengers share a vehicle only if all their pickup->destination
// paths merge into ONE straight line travelling in ONE direction (see tryMergePath).
async function autoMatchRide(ride) {
  const route = await getRidePath(ride);
  if (!route) return null;

  const joinablePools = await prisma.pools.findMany({
    where: { status: { in: ['open', 'accepted'] } },
    orderBy: { created_at: 'asc' },
  });

  for (const pool of joinablePools) {
    const activeMembers = await prisma.pool_members.findMany({ where: { pool_id: pool.id, status: 'active' } });
    if (activeMembers.length === 0) continue; // empty/orphaned group - never join it

    const usedSeats = activeMembers.reduce((sum, m) => sum + m.seats_allocated, 0);
    if (usedSeats + ride.seats_requested > pool.capacity_snapshot) continue;

    const merged = dhakaGraph.tryMergePath(Array.isArray(pool.spine) ? pool.spine : [], route.path);
    if (!merged) continue;

    try {
      await prisma.pool_members.create({
        data: {
          pool_id: pool.id,
          ride_request_id: ride.id,
          seats_allocated: ride.seats_requested,
          agreed_fare_paisa: 0,
        },
      });
    } catch (err) {
      if (isSeatConflict(err)) continue;
      throw err;
    }

    // The DB trigger just set the ride to 'matched'. If a driver already
    // accepted this pool, the new rider must be 'accepted' too, otherwise
    // the next pool-wide status change would hit an illegal transition.
    if (pool.status === 'accepted') {
      await prisma.ride_requests.update({ where: { id: ride.id }, data: { status: 'accepted' } });
    }

    await prisma.pools.update({ where: { id: pool.id }, data: { spine: merged } });
    await recalculateFaresForPool(pool.id);
    return pool.id;
  }

  const pool = await prisma.pools.create({
    data: { vehicle_id: null, capacity_snapshot: UNASSIGNED_CAPACITY, status: 'open', spine: route.path },
  });

  const fare = fareService.calculateFare({
    distanceKm: route.distanceKm,
    seatsRequested: ride.seats_requested,
    isPooled: false,
  });

  await prisma.pool_members.create({
    data: {
      pool_id: pool.id,
      ride_request_id: ride.id,
      seats_allocated: ride.seats_requested,
      agreed_fare_paisa: fare.totalFarePaisa,
    },
  });

  return pool.id;
}

async function sweepUnmatchedRides() {
  const unmatched = await prisma.ride_requests.findMany({
    where: { status: 'requested' },
    orderBy: { requested_at: 'asc' },
  });
  for (const ride of unmatched) {
    await autoMatchRide(ride);
  }
}

// Called after a passenger cancels: rebuild the combined route from whoever
// is left, or close the pool entirely if nobody is left.
async function handleMemberLeft(poolId) {
  const pool = await prisma.pools.findUnique({ where: { id: poolId } });
  if (!pool || ['completed', 'cancelled'].includes(pool.status)) return;

  const remaining = await prisma.pool_members.findMany({
    where: { pool_id: poolId, status: 'active' },
    orderBy: { joined_at: 'asc' },
  });

  if (remaining.length === 0) {
    await prisma.pools.update({ where: { id: poolId }, data: { status: 'cancelled' } });
    return;
  }

  let spine = null;
  for (const m of remaining) {
    const ride = await prisma.ride_requests.findUnique({ where: { id: m.ride_request_id } });
    const route = await getRidePath(ride);
    const merged = dhakaGraph.tryMergePath(spine || [], route.path);
    if (!merged) { spine = null; break; }
    spine = merged;
  }

  if (spine) await prisma.pools.update({ where: { id: poolId }, data: { spine } });
  await recalculateFaresForPool(poolId);
}

async function zoneNameMap() {
  const zones = await prisma.zones.findMany();
  const map = {};
  zones.forEach((z) => { map[z.code] = z.name; });
  return map;
}

async function buildMemberDetails(members) {
  const nameMap = await zoneNameMap();
  return Promise.all(
    members.map(async (m) => {
      const ride = await prisma.ride_requests.findUnique({ where: { id: m.ride_request_id } });
      const passenger = await prisma.users.findUnique({ where: { id: ride.passenger_id } });
      const route = await getRidePath(ride);
      return {
        pool_member_id: m.id,
        status: m.status,
        seats_allocated: m.seats_allocated,
        agreed_fare_paisa: m.agreed_fare_paisa,
        ride_request_id: ride.id,
        ride_status: ride.status,
        passenger_name: passenger.full_name,
        path: route ? route.path : [],
        path_names: route ? route.path.map((c) => nameMap[c] || c) : [],
        distance_km: route ? Number(route.distanceKm.toFixed(2)) : null,
      };
    })
  );
}

// Visible to EVERY driver. Looking at a group never locks it; only accepting does.
async function listOpenPoolsForDrivers() {
  const pools = await prisma.pools.findMany({
    where: { vehicle_id: null, status: 'open' },
    orderBy: { created_at: 'asc' },
  });

  const result = [];
  for (const pool of pools) {
    const members = await prisma.pool_members.findMany({ where: { pool_id: pool.id, status: 'active' } });
    if (members.length === 0) continue; // hide empty ghost groups
    result.push({ pool, members: await buildMemberDetails(members) });
  }
  return result;
}

// Atomic claim: only the first UPDATE that still sees vehicle_id = null wins.
async function acceptOpenPool(driverId, poolId) {
  const vehicle = await prisma.vehicles.findFirst({ where: { driver_id: driverId, status: 'active' } });
  if (!vehicle) throw new ApiError(400, 'You need an active vehicle to accept a ride');

  const alreadyBusy = await prisma.pools.findFirst({
    where: { vehicle_id: vehicle.id, status: { notIn: ['completed', 'cancelled'] } },
  });
  if (alreadyBusy) throw new ApiError(409, 'You already have an active ride - finish or cancel it first');

  const activeMembers = await prisma.pool_members.findMany({ where: { pool_id: poolId, status: 'active' } });
  if (activeMembers.length === 0) throw new ApiError(409, 'This ride is no longer available');

  const usedSeats = activeMembers.reduce((sum, m) => sum + m.seats_allocated, 0);
  if (vehicle.capacity < usedSeats) {
    throw new ApiError(400, `Your vehicle doesn't have enough seats for this ride (needs ${usedSeats})`);
  }

  const result = await prisma.pools.updateMany({
    where: { id: poolId, vehicle_id: null, status: 'open' },
    data: { vehicle_id: vehicle.id, capacity_snapshot: vehicle.capacity, status: 'accepted' },
  });

  if (result.count === 0) {
    throw new ApiError(409, 'This ride was just accepted by another driver');
  }

  return prisma.pools.findUnique({ where: { id: poolId } });
}

async function getPoolOwnedByDriver(poolId, driverId) {
  const pool = await prisma.pools.findUnique({ where: { id: poolId } });
  if (!pool) throw new ApiError(404, 'Pool not found');
  if (!pool.vehicle_id) throw new ApiError(403, 'This ride has not been accepted yet');
  const vehicle = await prisma.vehicles.findUnique({ where: { id: pool.vehicle_id } });
  if (!vehicle || vehicle.driver_id !== driverId) {
    throw new ApiError(403, 'You do not own the vehicle for this pool');
  }
  return pool;
}

async function listPoolsForDriver(driverId, status) {
  const vehicles = await prisma.vehicles.findMany({ where: { driver_id: driverId } });
  const vehicleIds = vehicles.map((v) => v.id);
  if (!vehicleIds.length) return [];
  return prisma.pools.findMany({
    where: { vehicle_id: { in: vehicleIds }, ...(status ? { status } : {}) },
    orderBy: { created_at: 'desc' },
  });
}

async function getPoolDetail(driverId, poolId) {
  const pool = await getPoolOwnedByDriver(poolId, driverId);
  const members = await prisma.pool_members.findMany({ where: { pool_id: poolId } });
  return { pool, members: await buildMemberDetails(members) };
}

// The vehicle's single combined route, every stop in driving order, and
// where the vehicle currently is. The vehicle marker only appears once the
// driver has actually arrived at the first pickup.
async function getCombinedRoute(poolId) {
  const pool = await prisma.pools.findUnique({ where: { id: poolId } });
  if (!pool) throw new ApiError(404, 'Pool not found');

  const members = await prisma.pool_members.findMany({
    where: { pool_id: poolId, status: { in: ['active', 'completed'] } },
    orderBy: { joined_at: 'asc' },
  });
  const nameMap = await zoneNameMap();

  const spine = Array.isArray(pool.spine) ? pool.spine : [];
  const cumulative = [0];
  for (let i = 1; i < spine.length; i++) {
    cumulative.push(cumulative[i - 1] + dhakaGraph.edgeWeight(spine[i - 1], spine[i]));
  }

  const events = [];
  const memberDetails = [];

  for (const m of members) {
    const ride = await prisma.ride_requests.findUnique({ where: { id: m.ride_request_id } });
    const passenger = await prisma.users.findUnique({ where: { id: ride.passenger_id } });
    const pickupZone = await prisma.zones.findUnique({ where: { id: ride.pickup_zone_id } });
    const destZone = await prisma.zones.findUnique({ where: { id: ride.destination_zone_id } });
    const memberRoute = dhakaGraph.shortestPath(pickupZone.code, destZone.code);

    memberDetails.push({
      pool_member_id: m.id,
      ride_request_id: ride.id,
      seats_allocated: m.seats_allocated,
      passenger_name: passenger.full_name,
      path: memberRoute ? memberRoute.path : [],
      path_names: memberRoute ? memberRoute.path.map((c) => nameMap[c] || c) : [],
      distance_km: memberRoute ? Number(memberRoute.distanceKm.toFixed(2)) : null,
      agreed_fare_paisa: m.agreed_fare_paisa,
    });

    const pickupIdx = spine.indexOf(pickupZone.code);
    const dropoffIdx = spine.indexOf(destZone.code);
    events.push({ type: 'pickup', member_id: m.id, passenger_name: passenger.full_name, code: pickupZone.code, pos: pickupIdx >= 0 ? cumulative[pickupIdx] : -1 });
    events.push({ type: 'dropoff', member_id: m.id, passenger_name: passenger.full_name, code: destZone.code, pos: dropoffIdx >= 0 ? cumulative[dropoffIdx] : Infinity });
  }

  // Driving order; at the same stop, drop-offs come before pickups (frees seats first).
  events.sort((a, b) => (a.pos - b.pos) || ((a.type === 'dropoff' ? 0 : 1) - (b.type === 'dropoff' ? 0 : 1)));

  const currentStopIndex = Math.min(pool.current_stop_index, events.length);
  const vehicleActive = ['driver_arrived', 'started', 'completed'].includes(pool.status);
  let vehiclePosition = null;
  if (vehicleActive && spine.length) {
    vehiclePosition = currentStopIndex === 0 ? spine[0] : (events[currentStopIndex - 1]?.code || spine[0]);
  }

  return {
    pool,
    spine,
    spine_names: spine.map((c) => nameMap[c] || c),
    events,
    currentStopIndex,
    vehiclePosition,
    members: memberDetails,
  };
}

async function getCombinedRouteForDriver(driverId, poolId) {
  await getPoolOwnedByDriver(poolId, driverId);
  return getCombinedRoute(poolId);
}

// Advances the vehicle to the next distinct stop, consuming every pickup and
// drop-off that happens at that stop together.
async function advanceStop(driverId, poolId) {
  await getPoolOwnedByDriver(poolId, driverId);
  const pool = await prisma.pools.findUnique({ where: { id: poolId } });
  if (pool.status !== 'started') throw new ApiError(400, 'Can only advance stops while the trip is started');

  const route = await getCombinedRoute(poolId);
  let idx = pool.current_stop_index;
  if (idx >= route.events.length) {
    throw new ApiError(400, 'All stops already reached - ready to complete the trip');
  }

  const nextPos = route.events[idx].pos;
  while (idx < route.events.length && route.events[idx].pos === nextPos) idx += 1;

  return prisma.pools.update({ where: { id: poolId }, data: { current_stop_index: idx } });
}

// What a PASSENGER may see about their pool: the shared route and progress,
// but other riders' fares are never included and other riders appear by first name only.
async function getRouteInfoForRide(rideId, passengerId) {
  const ride = await prisma.ride_requests.findUnique({ where: { id: rideId } });
  if (!ride || ride.passenger_id !== passengerId) throw new ApiError(403, 'You do not have access to this ride');

  const route = await getRidePath(ride);
  const membership = await prisma.pool_members.findFirst({ where: { ride_request_id: rideId, status: 'active' } });
  if (!membership) return { ownPath: route ? route.path : [], poolMembers: [], progress: null };

  const combined = await getCombinedRoute(membership.pool_id);
  const firstName = (name) => name.split(' ')[0];
  const me = combined.members.find((m) => m.ride_request_id === rideId);

  const poolMembers = combined.members.map((m) => {
    const isYou = m.ride_request_id === rideId;
    return {
      pool_member_id: m.pool_member_id,
      is_you: isYou,
      passenger_name: isYou ? m.passenger_name : firstName(m.passenger_name),
      path: m.path,
      path_names: m.path_names,
      distance_km: m.distance_km,
      agreed_fare_paisa: isYou ? m.agreed_fare_paisa : null,
    };
  });

  const events = combined.events.map((e) => ({
    type: e.type,
    code: e.code,
    pos: e.pos,
    passenger_name: me && e.member_id === me.pool_member_id ? e.passenger_name : firstName(e.passenger_name),
  }));

  return {
    ownPath: route ? route.path : [],
    poolMembers,
    progress: {
      spine: combined.spine,
      spine_names: combined.spine_names,
      vehiclePosition: combined.vehiclePosition,
      currentStopIndex: combined.currentStopIndex,
      events,
      poolStatus: combined.pool.status,
    },
  };
}

const POOL_TRANSITIONS = {
  accepted: ['driver_arrived', 'cancelled'],
  driver_arrived: ['started', 'cancelled'],
  started: ['completed'],
  completed: [],
  cancelled: [],
};

async function transitionPool(driverId, poolId, newStatus) {
  const pool = await getPoolOwnedByDriver(poolId, driverId);
  const allowed = POOL_TRANSITIONS[pool.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(400, `Cannot move pool from '${pool.status}' to '${newStatus}'`);
  }

  const data = { status: newStatus };

  // The driver is already standing at the first pickup when the trip starts,
  // so that stop counts as reached the moment the trip begins.
  if (newStatus === 'started') {
    const route = await getCombinedRoute(poolId);
    let idx = 0;
    if (route.events.length) {
      const firstPos = route.events[0].pos;
      while (idx < route.events.length && route.events[idx].pos === firstPos) idx += 1;
    }
    data.current_stop_index = idx;
  }

  const updated = await prisma.pools.update({ where: { id: poolId }, data });

  if (newStatus === 'completed' || newStatus === 'cancelled') {
    await sweepUnmatchedRides();
  }
  return updated;
}

const markDriverArrived = (driverId, poolId) => transitionPool(driverId, poolId, 'driver_arrived');
const startPool = (driverId, poolId) => transitionPool(driverId, poolId, 'started');
const completePool = (driverId, poolId) => transitionPool(driverId, poolId, 'completed');
const cancelPool = (driverId, poolId) => transitionPool(driverId, poolId, 'cancelled');

module.exports = {
  autoMatchRide,
  sweepUnmatchedRides,
  handleMemberLeft,
  listOpenPoolsForDrivers,
  acceptOpenPool,
  listPoolsForDriver,
  getPoolDetail,
  getCombinedRoute,
  getCombinedRouteForDriver,
  advanceStop,
  getRouteInfoForRide,
  markDriverArrived,
  startPool,
  completePool,
  cancelPool,
};