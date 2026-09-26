const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/rateLimit.middleware');
const { signupSchema, loginSchema } = require('../validators/auth.schema');
const controller = require('../controllers/auth.controller');

const router = express.Router();

router.use(authLimiter);

router.post('/passenger/signup', validate(signupSchema), controller.passengerSignup);
router.post('/passenger/login', validate(loginSchema), controller.passengerLogin);
router.post('/driver/signup', validate(signupSchema), controller.driverSignup);
router.post('/driver/login', validate(loginSchema), controller.driverLogin);
router.get('/me', authenticate, controller.me);

module.exports = router;