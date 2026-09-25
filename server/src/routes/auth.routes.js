const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { signupSchema, loginSchema } = require('../validators/auth.schema');
const controller = require('../controllers/auth.controller');

const router = express.Router();

router.post('/passenger/signup', validate(signupSchema), controller.passengerSignup);
router.post('/passenger/login', validate(loginSchema), controller.passengerLogin);
router.get('/me', authenticate, controller.me);
router.post('/driver/signup', validate(signupSchema), controller.driverSignup);
router.post('/driver/login', validate(loginSchema), controller.driverLogin);

module.exports = router;
