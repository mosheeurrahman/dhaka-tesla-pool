const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { createRideSchema, rideIdParamSchema } = require('../validators/ride.schema');
const controller = require('../controllers/ride.controller');

const router = express.Router();

router.use(authenticate, authorize('passenger'));

router.post('/', validate(createRideSchema), controller.createRide);

// '/me' before '/:id' - same ordering trap as vehicles.
router.get('/me', controller.getMyRides);
router.get('/:id', validate(rideIdParamSchema), controller.getRideById);
router.get('/:id/history', validate(rideIdParamSchema), controller.getRideHistory);
router.patch('/:id/cancel', validate(rideIdParamSchema), controller.cancelRide);

module.exports = router;