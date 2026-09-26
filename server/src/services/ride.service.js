const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const zoneService = require('./zone.service');

// Cancellation is only allowed before the trip physically starts - once a
// driver has started the ride, cancelling it retroactively doesn't make
// sense (the vehicle already committed the seat and moved).
const CANCELLABLE_STATUSES = ['requested', 'matched', 'accepted', 'driver_arrived'];

async function logStatusHistory(rideId, status, changedByUserId, note) {
  await prisma.ride_status_history.create({
    data: {
      ride_request_id: rideId,
      status,
      changed_by_user_id: changedByUserId,
      note,
    },
  });
}

async function createRideRequest(passengerId, data) {
  const { pickup_zone_id, destination_zone_id, seats_requested } = data;

  // Reuses the same estimate logic from feature/zones-and-fare-service,
  // so "what a ride costs to preview" and "what it costs when actually
  // requested" can never drift apart into two separate calculations.
  const { fare } = await zoneService.estimateFare({
    pickup_zone_id,
    destination_zone_id,
    seats_requested,
    pooled: false, // not matched into a pool yet at creation time
  });

  const ride = await prisma.ride_requests.create({
    data: {
      passenger_id: passengerId,
      pickup_zone_id,
      destination_zone_id,
      seats_requested: seats_requested ?? 1,
      estimated_distance_km: fare.distanceKm,
      estimated_fare_paisa: fare.totalFarePaisa,
    },
  });

  await logStatusHistory(ride.id, 'requested', passengerId, 'Ride requested by passenger');

  return ride;
}

// Central ownership check - every function below that touches a specific
// ride by id goes through this first.
async function getRideByIdForPassenger(id, passengerId) {
  const ride = await prisma.ride_requests.findUnique({ where: { id } });
  if (!ride) throw new ApiError(404, 'Ride not found');
  if (ride.passenger_id !== passengerId) {
    throw new ApiError(403, 'You do not have access to this ride');
  }
  return ride;
}

async function getRidesForPassenger(passengerId) {
  return prisma.ride_requests.findMany({
    where: { passenger_id: passengerId },
    orderBy: { requested_at: 'desc' },
  });
}

async function getRideHistory(id, passengerId) {
  await getRideByIdForPassenger(id, passengerId);
  return prisma.ride_status_history.findMany({
    where: { ride_request_id: id },
    orderBy: { created_at: 'asc' },
  });
}

async function cancelRide(id, passengerId) {
  const ride = await getRideByIdForPassenger(id, passengerId);

  if (!CANCELLABLE_STATUSES.includes(ride.status)) {
    throw new ApiError(400, `Cannot cancel a ride that is already '${ride.status}'`);
  }

  const updated = await prisma.ride_requests.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  // If this ride was already matched into a pool, free its specific seat
  // too - otherwise the pool would still show a cancelled passenger as an
  // active member and their seat would stay wrongly reserved.
  const membership = await prisma.pool_members.findFirst({
    where: { ride_request_id: id, status: 'active' },
  });
  if (membership) {
    await prisma.pool_members.update({
      where: { id: membership.id },
      data: { status: 'cancelled', cancelled_at: new Date() },
    });
  }

  await logStatusHistory(id, 'cancelled', passengerId, 'Ride cancelled by passenger');

  return updated;
}

module.exports = {
  createRideRequest,
  getRideByIdForPassenger,
  getRidesForPassenger,
  getRideHistory,
  cancelRide,
};