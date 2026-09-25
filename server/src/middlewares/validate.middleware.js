const ApiError = require('../utils/ApiError');

// Wrap a Zod schema shaped like:
//   z.object({ body: z.object({...}), params: z.object({...}).optional(), query: z.object({...}).optional() })
// Usage in a route: router.post('/', validate(createRideSchema), controller.create)
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return next(new ApiError(400, 'Validation failed', details));
  }

  if (result.data.body) req.body = result.data.body;
  if (result.data.params) req.params = result.data.params;
  if (result.data.query) req.query = result.data.query;

  next();
};

module.exports = validate;