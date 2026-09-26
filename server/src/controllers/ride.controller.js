const rideService = require('../services/ride.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');

const createRide = asyncHandler(async (req, res) => {
  const ride = await rideService.createRideRequest(req.user.id, req.body);
  sendSuccess(res, 201, { ride }, 'Ride requested');
});

const getMyRides = asyncHandler(async (req, res) => {
  const rides = await rideService.getRidesForPassenger(req.user.id, req.query.status);
  sendSuccess(res, 200, { rides }, 'Your ride history');
});

const getRideById = asyncHandler(async (req, res) => {
  const detail = await rideService.getRideDetailWithPayment(req.params.id, req.user.id);
  sendSuccess(res, 200, detail, 'Ride detail');
});

const getRideHistory = asyncHandler(async (req, res) => {
  const history = await rideService.getRideHistory(req.params.id, req.user.id);
  sendSuccess(res, 200, { history }, 'Ride status history');
});

const cancelRide = asyncHandler(async (req, res) => {
  const ride = await rideService.cancelRide(req.params.id, req.user.id);
  sendSuccess(res, 200, { ride }, 'Ride cancelled');
});

module.exports = { createRide, getMyRides, getRideById, getRideHistory, cancelRide };