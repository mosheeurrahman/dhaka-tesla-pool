const poolService = require('../services/pool.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');

const getAvailableRequests = asyncHandler(async (req, res) => {
  const requests = await poolService.listAvailableRequests(req.query.pickup_zone_id);
  sendSuccess(res, 200, { requests }, 'Unmatched ride requests');
});

const createPool = asyncHandler(async (req, res) => {
  const pool = await poolService.createPool(req.user.id, req.body);
  sendSuccess(res, 201, { pool }, 'Pool created');
});

const joinPool = asyncHandler(async (req, res) => {
  const pool = await poolService.joinPool(req.user.id, req.params.id, req.body);
  sendSuccess(res, 200, { pool }, 'Ride added to pool');
});

const getMyPools = asyncHandler(async (req, res) => {
  const pools = await poolService.listPoolsForDriver(req.user.id, req.query.status);
  sendSuccess(res, 200, { pools }, 'Your pools');
});

const getPoolById = asyncHandler(async (req, res) => {
  const detail = await poolService.getPoolDetail(req.user.id, req.params.id);
  sendSuccess(res, 200, detail, 'Pool detail');
});

const acceptPool = asyncHandler(async (req, res) => {
  const pool = await poolService.acceptPool(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Pool accepted');
});

const markDriverArrived = asyncHandler(async (req, res) => {
  const pool = await poolService.markDriverArrived(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Driver marked as arrived');
});

const startPool = asyncHandler(async (req, res) => {
  const pool = await poolService.startPool(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Trip started');
});

const completePool = asyncHandler(async (req, res) => {
  const pool = await poolService.completePool(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Trip completed');
});

const cancelPool = asyncHandler(async (req, res) => {
  const pool = await poolService.cancelPool(req.user.id, req.params.id);
  sendSuccess(res, 200, { pool }, 'Pool cancelled');
});

const getMyPoolsDetailed = asyncHandler(async (req, res) => {
  const pools = await poolService.listPoolsForDriverDetailed(req.user.id, req.query.status);
  sendSuccess(res, 200, { pools }, 'Your pools with passenger detail');
});

module.exports = {
  getAvailableRequests,
  createPool,
  joinPool,
  getMyPools,
  getPoolById,
  acceptPool,
  markDriverArrived,
  startPool,
  completePool,
  cancelPool,
  getMyPoolsDetailed,
};