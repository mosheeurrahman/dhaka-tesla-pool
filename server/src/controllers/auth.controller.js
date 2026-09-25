const authService = require('../services/auth.service');
const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const sanitizeUser = require('../utils/sanitizeUser');
const ApiError = require('../utils/ApiError');

const passengerSignup = asyncHandler(async (req, res) => {
  const { user, token } = await authService.signup({
    ...req.body,
    role: 'passenger',
  });
  sendSuccess(res, 201, { user: sanitizeUser(user), token }, 'Signup successful');
});

const passengerLogin = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login({
    ...req.body,
    role: 'passenger',
  });
  sendSuccess(res, 200, { user: sanitizeUser(user), token }, 'Login successful');
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.users.findUnique({ where: { id: req.user.id } });
  if (!user) throw new ApiError(404, 'User not found');
  sendSuccess(res, 200, { user: sanitizeUser(user) }, 'Current user');
});

const driverSignup = asyncHandler(async (req, res) => {
  const { user, token } = await authService.signup({
    ...req.body,
    role: 'driver',
  });
  sendSuccess(res, 201, { user: sanitizeUser(user), token }, 'Signup successful');
});

const driverLogin = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login({
    ...req.body,
    role: 'driver',
  });
  sendSuccess(res, 200, { user: sanitizeUser(user), token }, 'Login successful');
});

module.exports = { passengerSignup, passengerLogin, driverSignup, driverLogin, me };