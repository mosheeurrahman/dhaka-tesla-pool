const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
  createPoolSchema,
  joinPoolSchema,
  poolIdParamSchema,
  availableRequestsQuerySchema,
} = require('../validators/pool.schema');
const controller = require('../controllers/pool.controller');

const router = express.Router();

router.use(authenticate, authorize('driver'));

// Specific paths before '/:id' - same ordering trap as vehicles/rides.
router.get(
  '/available-requests',
  validate(availableRequestsQuerySchema),
  controller.getAvailableRequests
);
router.get('/mine', controller.getMyPools);
router.get('/mine/detailed', controller.getMyPoolsDetailed);

router.post('/', validate(createPoolSchema), controller.createPool);
router.post('/:id/join', validate(joinPoolSchema), controller.joinPool);

router.get('/:id', validate(poolIdParamSchema), controller.getPoolById);
router.patch('/:id/accept', validate(poolIdParamSchema), controller.acceptPool);
router.patch('/:id/arrived', validate(poolIdParamSchema), controller.markDriverArrived);
router.patch('/:id/start', validate(poolIdParamSchema), controller.startPool);
router.patch('/:id/complete', validate(poolIdParamSchema), controller.completePool);
router.patch('/:id/cancel', validate(poolIdParamSchema), controller.cancelPool);

module.exports = router;