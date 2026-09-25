const { z } = require('zod');

const signupSchema = z.object({
  body: z.object({
    full_name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(6).max(20).optional(),
    password: z.string().min(8).max(72),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  }),
});

module.exports = { signupSchema, loginSchema };