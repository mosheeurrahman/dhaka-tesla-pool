const { z } = require('zod');

const createRideSchema = z.object({
  body: z.object({
    pickup_zone_id: z.string().uuid(),
    destination_zone_id: z.string().uuid(),
    seats_requested: z.number().int().min(1).max(3).optional(),
  }),
});

const rideIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

module.exports = { createRideSchema, rideIdParamSchema };