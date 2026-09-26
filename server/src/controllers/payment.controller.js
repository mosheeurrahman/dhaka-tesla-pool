const paymentService = require('../services/payment.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');

const createPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.createPayment(req.user.id, req.body);
  sendSuccess(res, 201, { payment }, 'Payment recorded');
});

const getPaymentForRide = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentForRide(req.user.id, req.params.rideId);
  sendSuccess(res, 200, { payment }, 'Payment detail');
});

module.exports = { createPayment, getPaymentForRide };