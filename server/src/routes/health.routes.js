const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const prisma = require('../config/db');

const router = express.Router();

// Confirms the API process itself is up
router.get(
  '/',
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, { status: 'ok' }, 'Server is healthy');
  })
);

// Confirms the database connection is actually reachable
router.get(
  '/db',
  asyncHandler(async (req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    sendSuccess(res, 200, { status: 'ok' }, 'Database is reachable');
  })
);

module.exports = router;