const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleIdParamSchema,
} = require('../validators/vehicle.schema');
const controller = require('../controllers/vehicle.controller');

const router = express.Router();

router.use(authenticate, authorize('driver'));

router.post('/', validate(createVehicleSchema), controller.createVehicle);

// IMPORTANT: '/me' must be registered before '/:id', or Express will try
// to match "me" as a UUID :id param and fail with a confusing 400 instead
// of hitting this route.
router.get('/me', controller.getMyVehicles);
router.get('/:id', validate(vehicleIdParamSchema), controller.getVehicleById);
router.patch('/:id', validate(updateVehicleSchema), controller.updateVehicle);

module.exports = router;