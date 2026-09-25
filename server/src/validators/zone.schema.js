const { z } = require('zod');

const fareEstimateSchema = z.object({
  query: z.object({
    pickup_zone_id: z.string().uuid(),
    destination_zone_id: z.string().uuid(),
    seats_requested: z.coerce.number().int().min(1).max(3).optional(),
    pooled: z.coerce.boolean().optional(),
  }),
});

module.exports = { fareEstimateSchema };