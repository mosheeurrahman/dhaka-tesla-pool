const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { signupSchema, loginSchema } = require('../validators/auth.schema');
const controller = require('../controllers/auth.controller');

const router = express.Router();

router.post('/passenger/signup', validate(signupSchema), controller.passengerSignup);
router.post('/passenger/login', validate(loginSchema), controller.passengerLogin);
router.get('/me', authenticate, controller.me);

module.exports = router;
