const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const fareService = require('./fare.service');
const dhakaGraph = require('../data/dhakaGraph');

async function listActiveZones() {
  return prisma.zones.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } });
}

async function getZoneById(id) {
  const zone = await prisma.zones.findUnique({ where: { id } });
  if (!zone) throw new ApiError(404, 'Zone not found');
  return zone;
}

async function estimateFare({ pickup_zone_id, destination_zone_id, seats_requested, pooled }) {
  if (pickup_zone_id === destination_zone_id) {
    throw new ApiError(400, 'Pickup and destination zones must be different');
  }

  const [pickupZone, destinationZone] = await Promise.all([
    getZoneById(pickup_zone_id),
    getZoneById(destination_zone_id),
  ]);

  const route = dhakaGraph.shortestPath(pickupZone.code, destinationZone.code);
  if (!route) throw new ApiError(400, 'No route found between these zones');

  const fare = fareService.calculateFare({
    distanceKm: route.distanceKm,
    seatsRequested: seats_requested ?? 1,
    isPooled: pooled ?? false,
  });

  return { pickupZone, destinationZone, route, fare };
}

// Full graph structure for the frontend to draw the base map once.
async function getGraph() {
  const zones = await listActiveZones();
  const nodes = zones.map((z) => ({
    code: z.code,
    name: z.name,
    x: Number(z.latitude),
    y: Number(z.longitude),
  }));
  const edges = dhakaGraph.EDGES.map(([from, to, weight]) => ({ from, to, weight }));
  return { nodes, edges };
}

module.exports = { listActiveZones, getZoneById, estimateFare, getGraph };