const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { fareEstimateSchema } = require('../validators/zone.schema');
const controller = require('../controllers/zone.controller');

const router = express.Router();

// Public reference data - no auth required to browse zones or preview a fare
router.get('/', controller.listZones);
router.get('/fare-estimate', validate(fareEstimateSchema), controller.getFareEstimate);

module.exports = router;