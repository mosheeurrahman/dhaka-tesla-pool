const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');

async function createVehicle(driverId, data) {
  return prisma.vehicles.create({
    data: {
      driver_id: driverId,
      name: data.name,
      model: data.model,
      plate_number: data.plate_number,
      capacity: data.capacity ?? 3,
    },
  });
}

async function getVehiclesForDriver(driverId) {
  return prisma.vehicles.findMany({
    where: { driver_id: driverId },
    orderBy: { created_at: 'desc' },
  });
}

// Central ownership check - every other function that touches a specific
// vehicle by id calls through this first, so "a driver can only see/edit
// their own vehicle" is enforced in exactly one place.
async function getVehicleByIdForDriver(id, driverId) {
  const vehicle = await prisma.vehicles.findUnique({ where: { id } });
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  if (vehicle.driver_id !== driverId) {
    throw new ApiError(403, 'You do not own this vehicle');
  }
  return vehicle;
}

async function updateVehicle(id, driverId, data) {
  await getVehicleByIdForDriver(id, driverId);
  return prisma.vehicles.update({ where: { id }, data });
}

module.exports = {
  createVehicle,
  getVehiclesForDriver,
  getVehicleByIdForDriver,
  updateVehicle,
};