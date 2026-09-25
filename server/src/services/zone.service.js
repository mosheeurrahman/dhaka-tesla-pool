const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const fareService = require('./fare.service');

async function listActiveZones() {
  return prisma.zones.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
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

  const distanceKm = fareService.distanceBetweenZones(pickupZone, destinationZone);

  const fare = fareService.calculateFare({
    distanceKm,
    seatsRequested: seats_requested ?? 1,
    isPooled: pooled ?? false,
  });

  return { pickupZone, destinationZone, fare };
}

module.exports = { listActiveZones, getZoneById, estimateFare };