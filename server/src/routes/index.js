const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const driverRoutes = require('./driver.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/drivers', driverRoutes);

module.exports = router;