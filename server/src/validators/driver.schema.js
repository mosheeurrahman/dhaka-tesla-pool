const { z } = require('zod');

const statusSchema = z.object({
  body: z.object({
    is_online: z.boolean(),
  }),
});

module.exports = { statusSchema };