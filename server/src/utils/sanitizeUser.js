// Strip password_hash before a user object ever leaves the API.
function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = sanitizeUser;