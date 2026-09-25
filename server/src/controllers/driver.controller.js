const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const sanitizeUser = require('../utils/sanitizeUser');
const ApiError = require('../utils/ApiError');

const getMyProfile = asyncHandler(async (req, res) => {
  const driver = await prisma.users.findUnique({ where: { id: req.user.id } });
  if (!driver) throw new ApiError(404, 'Driver not found');
  sendSuccess(res, 200, { driver: sanitizeUser(driver) }, 'Driver profile');
});

const updateOnlineStatus = asyncHandler(async (req, res) => {
  const driver = await prisma.users.update({
    where: { id: req.user.id },
    data: { is_online: req.body.is_online },
  });
  sendSuccess(
    res,
    200,
    { driver: sanitizeUser(driver) },
    driver.is_online ? 'You are now online' : 'You are now offline'
  );
});

module.exports = { getMyProfile, updateOnlineStatus };