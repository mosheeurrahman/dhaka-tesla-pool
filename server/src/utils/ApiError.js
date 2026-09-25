// A thrown ApiError carries its own HTTP status code, so any route handler
// can `throw new ApiError(404, 'Ride not found')` and the central error
// middleware will turn it into the right response automatically.
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;