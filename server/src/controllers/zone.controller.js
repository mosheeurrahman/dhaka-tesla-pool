const zoneService = require('../services/zone.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');

const listZones = asyncHandler(async (req, res) => {
  const zones = await zoneService.listActiveZones();
  sendSuccess(res, 200, { zones }, 'Available zones');
});

const getFareEstimate = asyncHandler(async (req, res) => {
  const result = await zoneService.estimateFare(req.query);
  sendSuccess(res, 200, result, 'Fare estimate');
});
const getGraph = asyncHandler(async (req, res) => {
  const graph = await zoneService.getGraph();
  sendSuccess(res, 200, { graph }, 'Dhaka route graph');
});

module.exports = { listZones, getFareEstimate, getGraph };