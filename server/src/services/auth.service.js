const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');

const SALT_ROUNDS = 10;

function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function signup({ full_name, email, phone, password, role }) {
  const existing = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.users.create({
    data: { full_name, email, phone, password_hash, role },
  });

  return { user, token: generateToken(user) };
}

async function login({ email, password, role }) {
  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, role },
  });

  // Deliberately identical error for "no such user" and "wrong password" -
  // don't let a login attempt reveal whether an email is registered.
  if (!user || !user.is_active) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  return { user, token: generateToken(user) };
}

module.exports = { signup, login, generateToken };
