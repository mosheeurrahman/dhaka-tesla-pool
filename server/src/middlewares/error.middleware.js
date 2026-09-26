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

function extractRawMessage(err) {
  const directMessage = err?.message || '';
  const adapterMessage = err?.meta?.driverAdapterError?.message || '';
  return `${directMessage}\n${adapterMessage}`;
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let statusCode = 500;
  let payload = { success: false, message: 'Something went wrong on our end' };

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    payload = { success: false, message: err.message, errors: err.details || undefined };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      payload = {
        success: false,
        message: `A record with this ${err.meta?.target || 'value'} already exists`,
      };
    } else if (err.code === 'P2003') {
      statusCode = 400;
      payload = { success: false, message: 'Related record not found (invalid reference)' };
    } else if (err.code === 'P2025') {
      statusCode = 404;
      payload = { success: false, message: 'Record not found' };
    }
    // Other Prisma codes (like P2039, a generic raw-DB-error wrapper)
    // fall through to the trigger-message check below rather than
    // being left at a blind 500.
  }

  // Universal fallback: regardless of how Prisma wrapped the error, if
  // its message - including any nested driver-adapter message - matches
  // one of our own trigger RAISE EXCEPTION strings, this is a business
  // rule violation, not a server bug.
  if (statusCode === 500) {
    const rawMessage = extractRawMessage(err);
    const matched = KNOWN_TRIGGER_MESSAGE_PATTERNS.find((p) => rawMessage.includes(p));
    if (matched) {
      statusCode = 400;
      const cleanLine = rawMessage.split('\n').find((line) => line.includes(matched)) || matched;
      payload = { success: false, message: cleanLine.trim() };
    }
  }

  const isHandledCleanly = statusCode !== 500;
  if (!(process.env.NODE_ENV === 'test' && isHandledCleanly)) {
    console.error(err);
  }

  return res.status(statusCode).json(payload);
}

module.exports = errorHandler;