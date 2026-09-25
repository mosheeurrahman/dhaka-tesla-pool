const { z } = require('zod');

const createVehicleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
    plate_number: z.string().trim().min(2).max(30),
    capacity: z.number().int().min(1).max(3).optional(),
  }),
});

const updateVehicleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    model: z.string().trim().min(1).max(100).optional(),
    capacity: z.number().int().min(1).max(3).optional(),
    status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  }),
});

const vehicleIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

module.exports = { createVehicleSchema, updateVehicleSchema, vehicleIdParamSchema };