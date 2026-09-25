// Standard success response shape, used everywhere so the frontend can
// rely on { success, message, data } regardless of which endpoint it hit.
function sendSuccess(res, statusCode, data = null, message = 'Success') {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

module.exports = { sendSuccess };