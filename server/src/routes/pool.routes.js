const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { poolIdParamSchema, poolHistoryQuerySchema } = require('../validators/pool.schema');
const controller = require('../controllers/pool.controller');

const router = express.Router();

router.use(authenticate, authorize('driver'));

// IMPORTANT: '/open' and '/mine' MUST be registered before '/:id', or
// Express matches them as the :id param and tries to validate "open"/"mine"
// as a UUID, failing with a 400 before ever reaching the real handler.
router.get('/open', controller.getOpenPools);
router.get('/mine', validate(poolHistoryQuerySchema), controller.getMyPools);

router.get('/:id', validate(poolIdParamSchema), controller.getPoolById);
router.get('/:id/combined-route', validate(poolIdParamSchema), controller.getCombinedRoute);
router.patch('/:id/accept', validate(poolIdParamSchema), controller.acceptPool);
router.patch('/:id/arrived', validate(poolIdParamSchema), controller.markDriverArrived);
router.patch('/:id/start', validate(poolIdParamSchema), controller.startPool);
router.patch('/:id/advance-stop', validate(poolIdParamSchema), controller.advanceStop);
router.patch('/:id/complete', validate(poolIdParamSchema), controller.completePool);
router.patch('/:id/cancel', validate(poolIdParamSchema), controller.cancelPool);

module.exports = router;