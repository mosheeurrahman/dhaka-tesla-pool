const { Prisma } = require('@prisma/client');
const ApiError = require('../utils/ApiError');

// Prisma can't validate our SQL check constraints or custom trigger rules
// (see the db pull warnings from the prisma-setup branch), so violations
// of those rules surface here as raw Postgres error messages rather than
// typed Prisma errors. These are the exact substrings our own trigger
// functions RAISE EXCEPTION with — safe to show the client since they
// describe a business rule, not an internal detail.
const KNOWN_TRIGGER_MESSAGE_PATTERNS = [
  'Pool capacity exceeded',
  'Cannot add a passenger to a pool that is not open',
  'Allocated seats cannot exceed requested seats',
  'Invalid ride status transition',
  'Invalid pool status transition',
  'must belong to an active',
  'Ride request does not exist',
  'Pool does not exist',
];

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.details || undefined,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: `A record with this ${err.meta?.target || 'value'} already exists`,
      });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Related record not found (invalid reference)',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }
  }

  const rawMessage = err?.message || '';
  const matched = KNOWN_TRIGGER_MESSAGE_PATTERNS.find((p) => rawMessage.includes(p));
  if (matched) {
    const cleanLine =
      rawMessage.split('\n').find((line) => line.includes(matched)) || matched;
    return res.status(400).json({
      success: false,
      message: cleanLine.trim(),
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Something went wrong on our end',
  });
}

module.exports = errorHandler;