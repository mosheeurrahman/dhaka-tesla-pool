const { z } = require('zod');

const createPoolSchema = z.object({
  body: z.object({
    vehicle_id: z.string().uuid(),
    ride_request_id: z.string().uuid(),
    seats_allocated: z.number().int().min(1).max(3).optional(),
  }),
});

const joinPoolSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    ride_request_id: z.string().uuid(),
    seats_allocated: z.number().int().min(1).max(3).optional(),
  }),
});

const poolIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const availableRequestsQuerySchema = z.object({
  query: z.object({
    pickup_zone_id: z.string().uuid().optional(),
  }),
});

const poolHistoryQuerySchema = z.object({
  query: z.object({
    status: z
      .enum(['open', 'accepted', 'driver_arrived', 'started', 'completed', 'cancelled'])
      .optional(),
  }),
});

module.exports = {
  createPoolSchema,
  joinPoolSchema,
  poolIdParamSchema,
  availableRequestsQuerySchema,
  poolHistoryQuerySchema,
};