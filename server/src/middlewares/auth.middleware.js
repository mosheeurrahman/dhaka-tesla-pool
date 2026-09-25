const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

// Verifies the Bearer token and attaches { id, role } to req.user.
// Doesn't hit the database - just trusts a validly-signed token.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Authentication token missing'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

// Usage: router.post('/vehicles', authenticate, authorize('driver'), controller.create)
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to do this'));
    }
    next();
  };
}

module.exports = { authenticate, authorize };