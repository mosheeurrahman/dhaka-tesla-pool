const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');

async function createPayment(passengerId, { ride_request_id, method }) {
  const ride = await prisma.ride_requests.findUnique({ where: { id: ride_request_id } });
  if (!ride) throw new ApiError(404, 'Ride not found');
  if (ride.passenger_id !== passengerId) {
    throw new ApiError(403, 'You do not have access to this ride');
  }
  if (ride.status !== 'completed') {
    throw new ApiError(400, `Cannot pay for a ride that is '${ride.status}', not completed`);
  }

  const amount = ride.final_fare_paisa ?? ride.estimated_fare_paisa;

  // Both methods are simulated (per the brief - no real gateway), so
  // payment is recorded as immediately 'paid' regardless of method.
  return prisma.payments.create({
    data: {
      ride_request_id,
      amount_paisa: amount,
      method,
      status: 'paid',
      paid_at: new Date(),
    },
  });
}

async function getPaymentForRide(passengerId, rideId) {
  const ride = await prisma.ride_requests.findUnique({ where: { id: rideId } });
  if (!ride) throw new ApiError(404, 'Ride not found');
  if (ride.passenger_id !== passengerId) {
    throw new ApiError(403, 'You do not have access to this ride');
  }

  const payment = await prisma.payments.findUnique({ where: { ride_request_id: rideId } });
  if (!payment) throw new ApiError(404, 'No payment recorded for this ride yet');

  return payment;
}

module.exports = { createPayment, getPaymentForRide };