const { z } = require('zod');

const createPaymentSchema = z.object({
  body: z.object({
    ride_request_id: z.string().uuid(),
    method: z.enum(['cash', 'teslapay']),
  }),
});

const ridePaymentParamSchema = z.object({
  params: z.object({ rideId: z.string().uuid() }),
});

module.exports = { createPaymentSchema, ridePaymentParamSchema };