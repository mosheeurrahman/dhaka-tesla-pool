const express = require('express');
const healthRoutes = require('./health.routes');

const router = express.Router();

router.use('/health', healthRoutes);

// Future route groups get mounted here, e.g.:
// router.use('/auth', authRoutes);
// router.use('/rides', rideRoutes);
// router.use('/pools', poolRoutes);

module.exports = router;