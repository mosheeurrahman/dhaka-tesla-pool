const vehicleService = require('../services/vehicle.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');

const createVehicle = asyncHandler(async (req, res) => {
  const vehicle = await vehicleService.createVehicle(req.user.id, req.body);
  sendSuccess(res, 201, { vehicle }, 'Vehicle created');
});

const getMyVehicles = asyncHandler(async (req, res) => {
  const vehicles = await vehicleService.getVehiclesForDriver(req.user.id);
  sendSuccess(res, 200, { vehicles }, 'Your vehicles');
});

const getVehicleById = asyncHandler(async (req, res) => {
  const vehicle = await vehicleService.getVehicleByIdForDriver(req.params.id, req.user.id);
  sendSuccess(res, 200, { vehicle }, 'Vehicle detail');
});

const updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await vehicleService.updateVehicle(req.params.id, req.user.id, req.body);
  sendSuccess(res, 200, { vehicle }, 'Vehicle updated');
});

module.exports = { createVehicle, getMyVehicles, getVehicleById, updateVehicle };