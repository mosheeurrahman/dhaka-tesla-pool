const poolService = require('../services/pool.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');

const getOpenPools = asyncHandler(async (req, res) => {
  const pools = await poolService.listOpenPoolsForDrivers(req.user.id);
  sendSuccess(res, 200, { pools }, 'Available ride requests');
});

const acceptPool = asyncHandler(async (req, res) => {
  const pool = await poolService.acceptOpenPool(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Ride accepted');
});

const getMyPools = asyncHandler(async (req, res) => {
  const pools = await poolService.listPoolsForDriver(req.user.id, req.query.status);
  sendSuccess(res, 200, { pools }, 'Your pools');
});

const getPoolById = asyncHandler(async (req, res) => {
  const detail = await poolService.getPoolDetail(req.user.id, req.params.id);
  sendSuccess(res, 200, detail, 'Pool detail');
});

const getCombinedRoute = asyncHandler(async (req, res) => {
  const route = await poolService.getCombinedRouteForDriver(req.user.id, req.params.id);
  sendSuccess(res, 200, { route }, 'Combined route');
});

const markDriverArrived = asyncHandler(async (req, res) => {
  const pool = await poolService.markDriverArrived(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Driver marked as arrived');
});

const startPool = asyncHandler(async (req, res) => {
  const pool = await poolService.startPool(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Trip started');
});

const advanceStop = asyncHandler(async (req, res) => {
  const pool = await poolService.advanceStop(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Advanced to next stop');
});

const completePool = asyncHandler(async (req, res) => {
  const pool = await poolService.completePool(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Trip completed');
});

const cancelPool = asyncHandler(async (req, res) => {
  const pool = await poolService.cancelPool(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Pool cancelled');
});

module.exports = {
  getOpenPools,
  acceptPool,
  getMyPools,
  getPoolById,
  getCombinedRoute,
  markDriverArrived,
  startPool,
  advanceStop,
  completePool,
  cancelPool,
};