const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const vehicleService = require('./vehicle.service');
const fareService = require('./fare.service');
const dhakaGraph = require('../data/dhakaGraph');

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

async function findAvailableDriverVehicle() {
  const onlineDrivers = await prisma.users.findMany({
    where: { role: 'driver', is_online: true, is_active: true },
    orderBy: { created_at: 'asc' },
  });
  for (const driver of onlineDrivers) {
    const vehicle = await prisma.vehicles.findFirst({ where: { driver_id: driver.id, status: 'active' } });
    if (!vehicle) continue;
    const activePool = await prisma.pools.findFirst({
      where: { vehicle_id: vehicle.id, status: { notIn: ['completed', 'cancelled'] } },
    });
    if (!activePool) return vehicle;
  }
  return null;
}

// Recomputes every active member's fare together whenever pool membership
// changes, so pooling fairness never depends on join order.
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

// ---------- automatic dispatch (replaces manual driver pool creation) ----------

// Called right after a ride is created. Tries to slot it into an existing
// open pool whose route overlaps by at least one edge; otherwise assigns
// the first available online driver and opens a brand-new pool.
// MATCHING RULE (documented): two rides are poolable if their shortest
// paths share at least one common graph edge - a literal shared road
// segment, not just a shared zone.
async function autoMatchRide(ride) {
  const rideEdgeKeys = await getRidePathEdgeKeys(ride);
  if (rideEdgeKeys.length === 0) return null;

  const openPools = await prisma.pools.findMany({ where: { status: 'open' }, orderBy: { created_at: 'asc' } });

  for (const pool of openPools) {
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

  const vehicle = await findAvailableDriverVehicle();
  if (!vehicle) return null; // stays 'requested', picked up by a later sweep

  const pool = await prisma.pools.create({
    data: { vehicle_id: vehicle.id, capacity_snapshot: vehicle.capacity, status: 'open' },
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

// Re-attempts matching for every still-unmatched request. Called when a
// driver goes online, or when a pool frees up a vehicle (completed/cancelled).
async function sweepUnmatchedRides() {
  const unmatched = await prisma.ride_requests.findMany({
    where: { status: 'requested' },
    orderBy: { requested_at: 'asc' },
  });
  for (const ride of unmatched) {
    await autoMatchRide(ride);
  }
}

// ---------- driver-facing reads ----------

async function getPoolOwnedByDriver(poolId, driverId) {
  const pool = await prisma.pools.findUnique({ where: { id: poolId } });
  if (!pool) throw new ApiError(404, 'Pool not found');
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

async function zoneNameMap() {
  const zones = await prisma.zones.findMany();
  const map = {};
  zones.forEach((z) => { map[z.code] = z.name; });
  return map;
}

async function getPoolDetail(driverId, poolId) {
  const pool = await getPoolOwnedByDriver(poolId, driverId);
  const members = await prisma.pool_members.findMany({ where: { pool_id: poolId } });
  const nameMap = await zoneNameMap();

  const memberDetails = await Promise.all(
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

  return { pool, members: memberDetails };
}

// ---------- combined route + progress ----------

async function getFoundingMemberRoute(poolId) {
  const founding = await prisma.pool_members.findFirst({ where: { pool_id: poolId }, orderBy: { joined_at: 'asc' } });
  if (!founding) return null;
  const ride = await prisma.ride_requests.findUnique({ where: { id: founding.ride_request_id } });
  return getRidePath(ride);
}

// Builds the vehicle's combined stop sequence. SIMPLIFYING ASSUMPTION
// (documented): the founding member's path is treated as the route's
// "spine"; every other member's pickup/dropoff is ordered by its position
// along that spine. This covers the common 2-3 rider overlapping-corridor
// case cleanly without solving a full vehicle-routing problem.
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
    events.push({
      type: 'pickup', member_id: m.id, passenger_name: passenger.full_name, code: pickupZone.code,
      pos: pickupIdx >= 0 ? cumulative[pickupIdx] : -1,
    });
    events.push({
      type: 'dropoff', member_id: m.id, passenger_name: passenger.full_name, code: destZone.code,
      pos: dropoffIdx >= 0 ? cumulative[dropoffIdx] : Infinity,
    });
  }

  events.sort((a, b) => a.pos - b.pos);

  const currentStopIndex = Math.min(pool.current_stop_index, events.length);
  const vehiclePosition = currentStopIndex === 0 ? spine[0] : events[currentStopIndex - 1]?.code;

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

async function advanceStop(driverId, poolId) {
  await getPoolOwnedByDriver(poolId, driverId);
  const pool = await prisma.pools.findUnique({ where: { id: poolId } });
  if (pool.status !== 'started') {
    throw new ApiError(400, 'Can only advance stops while the trip is started');
  }
  const route = await getCombinedRoute(poolId);
  if (pool.current_stop_index >= route.events.length) {
    throw new ApiError(400, 'All stops already reached - ready to complete the trip');
  }
  return prisma.pools.update({
    where: { id: poolId },
    data: { current_stop_index: pool.current_stop_index + 1 },
  });
}

// ---------- passenger-facing read ----------

async function getRouteInfoForRide(rideId, passengerId) {
  const ride = await prisma.ride_requests.findUnique({ where: { id: rideId } });
  if (!ride || ride.passenger_id !== passengerId) {
    throw new ApiError(403, 'You do not have access to this ride');
  }

  const route = await getRidePath(ride);
  const membership = await prisma.pool_members.findFirst({ where: { ride_request_id: rideId } });

  if (!membership) {
    return { ownPath: route ? route.path : [], poolMembers: [], progress: null };
  }

  const combined = await getCombinedRoute(membership.pool_id);
  const progress = ['driver_arrived', 'started'].includes(combined.pool.status)
    ? {
        spine: combined.spine,
        spine_names: combined.spine_names,
        vehiclePosition: combined.vehiclePosition,
        currentStopIndex: combined.currentStopIndex,
        totalStops: combined.events.length,
      }
    : null;

  return { ownPath: route ? route.path : [], poolMembers: combined.members, progress };
}

// ---------- pool lifecycle (unchanged from before) ----------

const POOL_TRANSITIONS = {
  open: ['accepted', 'cancelled'],
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
    await sweepUnmatchedRides(); // this vehicle is free again - pick up anyone waiting
  }

  return updated;
}

const acceptPool = (driverId, poolId) => transitionPool(driverId, poolId, 'accepted');
const markDriverArrived = (driverId, poolId) => transitionPool(driverId, poolId, 'driver_arrived');
const startPool = (driverId, poolId) => transitionPool(driverId, poolId, 'started');
const completePool = (driverId, poolId) => transitionPool(driverId, poolId, 'completed');
const cancelPool = (driverId, poolId) => transitionPool(driverId, poolId, 'cancelled');

module.exports = {
  autoMatchRide,
  sweepUnmatchedRides,
  listPoolsForDriver,
  getPoolDetail,
  getCombinedRoute,
  advanceStop,
  getRouteInfoForRide,
  acceptPool,
  markDriverArrived,
  startPool,
  completePool,
  cancelPool,
};