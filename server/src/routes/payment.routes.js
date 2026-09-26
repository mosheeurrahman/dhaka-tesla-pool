const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { createPaymentSchema, ridePaymentParamSchema } = require('../validators/payment.schema');
const controller = require('../controllers/payment.controller');

const router = express.Router();

router.use(authenticate, authorize('passenger'));

router.post('/', validate(createPaymentSchema), controller.createPayment);
router.get('/ride/:rideId', validate(ridePaymentParamSchema), controller.getPaymentForRide);

module.exports = router;