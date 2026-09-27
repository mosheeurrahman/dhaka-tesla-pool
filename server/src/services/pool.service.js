const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const fareService = require('./fare.service');
const dhakaGraph = require('../data/dhakaGraph');

const UNASSIGNED_CAPACITY = 3; // largest possible vehicle capacity - a safe ceiling before a driver (and their real capacity) is known

// ---------- path / matching helpers ----------

async function getRidePath(ride) {
  const pickup = await prisma.zones.findUnique({ where: { id: ride.pickup_zone_id } });
  const destination = await prisma.zones.findUnique({ where: { id: ride.destination_zone_id } });
  return dhakaGraph.shortestPath(pickup.code, destination.code);
}

async function getRidePathEdgeKeys(ride) {
  const route = await getRidePath(ride);
  if (!route) return [];
  return route.edges.map((e) => dhakaGraph.edgeKey(e.from, e.to));
}

async function getPoolEdgeUnion(poolId) {
  const members = await prisma.pool_members.findMany({ where: { pool_id: poolId, status: 'active' } });
  const edgeSet = new Set();
  for (const m of members) {
    const ride = await prisma.ride_requests.findUnique({ where: { id: m.ride_request_id } });
    const keys = await getRidePathEdgeKeys(ride);
    keys.forEach((k) => edgeSet.add(k));
  }
  return edgeSet;
}

function hasOverlap(edgeKeysA, edgeSetB) {
  return edgeKeysA.some((k) => edgeSetB.has(k));
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

// ---------- automatic passenger-side grouping (driver assignment is separate) ----------

// MATCHING RULE (documented): two rides are poolable if their Dijkstra
// shortest paths share at least one common graph edge - a literal shared
// road segment. Grouping happens automatically and is driver-independent;
// a group starts with no vehicle assigned (status 'open', vehicle_id null)
// and stays joinable by further overlapping rides while 'open' or
// 'accepted' (i.e. any time before the vehicle physically starts moving).
async function autoMatchRide(ride) {
  const rideEdgeKeys = await getRidePathEdgeKeys(ride);
  if (rideEdgeKeys.length === 0) return null;

  const joinablePools = await prisma.pools.findMany({
    where: { status: { in: ['open', 'accepted'] } },
    orderBy: { created_at: 'asc' },
  });

  for (const pool of joinablePools) {
    const activeMembers = await prisma.pool_members.findMany({ where: { pool_id: pool.id, status: 'active' } });
    const usedSeats = activeMembers.reduce((sum, m) => sum + m.seats_allocated, 0);
    if (usedSeats + ride.seats_requested > pool.capacity_snapshot) continue;

    const edgeUnion = await getPoolEdgeUnion(pool.id);
    if (hasOverlap(rideEdgeKeys, edgeUnion)) {
      await prisma.pool_members.create({
        data: {
          pool_id: pool.id,
          ride_request_id: ride.id,
          seats_allocated: ride.seats_requested,
          agreed_fare_paisa: 0,
        },
      });
      await recalculateFaresForPool(pool.id);
      return pool.id;
    }
  }

  // No overlapping group exists yet - open a brand-new, unassigned one.
  const pool = await prisma.pools.create({
    data: { vehicle_id: null, capacity_snapshot: UNASSIGNED_CAPACITY, status: 'open' },
  });

  const route = await getRidePath(ride);
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

// ---------- zone name lookup ----------

async function zoneNameMap() {
  const zones = await prisma.zones.findMany();
  const map = {};
  zones.forEach((z) => { map[z.code] = z.name; });
  return map;
}

// ---------- driver: browse unassigned groups (visible to ALL online drivers) ----------

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
        distance_km: route ? route.distanceKm : null,
      };
    })
  );
}

// Viewing this list is unrestricted for any authenticated driver - looking
// at a group never locks it. Only acceptOpenPool (below) does.
async function listOpenPoolsForDrivers() {
  const pools = await prisma.pools.findMany({
    where: { vehicle_id: null, status: 'open' },
    orderBy: { created_at: 'asc' },
  });

  return Promise.all(
    pools.map(async (pool) => {
      const members = await prisma.pool_members.findMany({ where: { pool_id: pool.id, status: 'active' } });
      return { pool, members: await buildMemberDetails(members) };
    })
  );
}

// Atomic claim: the WHERE clause only matches while the pool is still
// unassigned, so if two drivers click Accept at nearly the same instant,
// only the first UPDATE actually changes a row - the second gets count: 0
// and a clean 409, rather than both drivers silently believing they got it.
async function acceptOpenPool(driverId, poolId) {
  const vehicle = await prisma.vehicles.findFirst({ where: { driver_id: driverId, status: 'active' } });
  if (!vehicle) throw new ApiError(400, 'You need an active vehicle to accept a ride');

  const alreadyBusy = await prisma.pools.findFirst({
    where: { vehicle_id: vehicle.id, status: { notIn: ['completed', 'cancelled'] } },
  });
  if (alreadyBusy) throw new ApiError(409, 'You already have an active ride - finish or cancel it first');

  const activeMembers = await prisma.pool_members.findMany({ where: { pool_id: poolId, status: 'active' } });
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

// ---------- driver: own accepted/in-progress rides ----------

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

// ---------- combined route + progress ----------

async function getFoundingMemberRoute(poolId) {
  const founding = await prisma.pool_members.findFirst({ where: { pool_id: poolId }, orderBy: { joined_at: 'asc' } });
  if (!founding) return null;
  const ride = await prisma.ride_requests.findUnique({ where: { id: founding.ride_request_id } });
  return getRidePath(ride);
}

// SIMPLIFYING ASSUMPTION (documented): the founding member's path is the
// route's "spine"; every other member's pickup/dropoff is ordered by
// position along that spine. Covers the common 2-3 rider overlapping-
// corridor case without solving a full vehicle-routing problem.
async function getCombinedRoute(poolId) {
  const pool = await prisma.pools.findUnique({ where: { id: poolId } });
  const members = await prisma.pool_members.findMany({
    where: { pool_id: poolId, status: 'active' },
    orderBy: { joined_at: 'asc' },
  });
  const nameMap = await zoneNameMap();

  const spineRoute = await getFoundingMemberRoute(poolId);
  const spine = spineRoute ? spineRoute.path : [];

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
      passenger_name: passenger.full_name,
      path: memberRoute ? memberRoute.path : [],
      path_names: memberRoute ? memberRoute.path.map((c) => nameMap[c] || c) : [],
      distance_km: memberRoute ? memberRoute.distanceKm : null,
      agreed_fare_paisa: m.agreed_fare_paisa,
    });

    const pickupIdx = spine.indexOf(pickupZone.code);
    const dropoffIdx = spine.indexOf(destZone.code);
    events.push({ type: 'pickup', member_id: m.id, passenger_name: passenger.full_name, code: pickupZone.code, pos: pickupIdx >= 0 ? cumulative[pickupIdx] : -1 });
    events.push({ type: 'dropoff', member_id: m.id, passenger_name: passenger.full_name, code: destZone.code, pos: dropoffIdx >= 0 ? cumulative[dropoffIdx] : Infinity });
  }

  events.sort((a, b) => a.pos - b.pos);

  const currentStopIndex = Math.min(pool.current_stop_index, events.length);
  const vehiclePosition = currentStopIndex === 0 ? spine[0] : events[currentStopIndex - 1]?.code;

  return { pool, spine, spine_names: spine.map((c) => nameMap[c] || c), events, currentStopIndex, vehiclePosition, members: memberDetails };
}

async function advanceStop(driverId, poolId) {
  await getPoolOwnedByDriver(poolId, driverId);
  const pool = await prisma.pools.findUnique({ where: { id: poolId } });
  if (pool.status !== 'started') throw new ApiError(400, 'Can only advance stops while the trip is started');
  const route = await getCombinedRoute(poolId);
  if (pool.current_stop_index >= route.events.length) {
    throw new ApiError(400, 'All stops already reached - ready to complete the trip');
  }
  return prisma.pools.update({ where: { id: poolId }, data: { current_stop_index: pool.current_stop_index + 1 } });
}

// ---------- passenger-facing read ----------

async function getRouteInfoForRide(rideId, passengerId) {
  const ride = await prisma.ride_requests.findUnique({ where: { id: rideId } });
  if (!ride || ride.passenger_id !== passengerId) throw new ApiError(403, 'You do not have access to this ride');

  const route = await getRidePath(ride);
  const membership = await prisma.pool_members.findFirst({ where: { ride_request_id: rideId } });
  if (!membership) return { ownPath: route ? route.path : [], poolMembers: [], progress: null };

  const combined = await getCombinedRoute(membership.pool_id);
  const progress = ['driver_arrived', 'started'].includes(combined.pool.status)
    ? { spine: combined.spine, spine_names: combined.spine_names, vehiclePosition: combined.vehiclePosition, currentStopIndex: combined.currentStopIndex, totalStops: combined.events.length }
    : null;

  return { ownPath: route ? route.path : [], poolMembers: combined.members, progress };
}

// ---------- pool lifecycle (post-acceptance only) ----------

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
  const updated = await prisma.pools.update({ where: { id: poolId }, data: { status: newStatus } });
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
  listOpenPoolsForDrivers,
  acceptOpenPool,
  listPoolsForDriver,
  getPoolDetail,
  getCombinedRoute,
  advanceStop,
  getRouteInfoForRide,
  markDriverArrived,
  startPool,
  completePool,
  cancelPool,
};