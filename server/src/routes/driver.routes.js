const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { statusSchema } = require('../validators/driver.schema');
const controller = require('../controllers/driver.controller');

const router = express.Router();

router.use(authenticate, authorize('driver'));

router.get('/me', controller.getMyProfile);
router.patch('/status', validate(statusSchema), controller.updateOnlineStatus);

module.exports = router;