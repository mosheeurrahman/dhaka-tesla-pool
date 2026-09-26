const rateLimit = require('express-rate-limit');

// Skipped entirely during automated tests so the suite never gets
// throttled by its own repeated signup/login calls.
const skipInTest = () => process.env.NODE_ENV === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    success: false,
    message: 'Too many attempts from this IP. Please try again later.',
  },
});

module.exports = { authLimiter };