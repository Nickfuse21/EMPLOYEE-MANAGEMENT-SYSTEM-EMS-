/**
 * Validation runner for express-validator chains.
 *
 * Place after a list of validation rules. If any rule failed it aggregates the
 * messages into a single 400 response; otherwise it passes control onward.
 */
import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

export const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  // Reduce express-validator's output to a clean { field: message } map.
  const details = {};
  for (const err of result.array()) {
    if (!details[err.path]) details[err.path] = err.msg;
  }
  next(ApiError.badRequest('Validation failed', details));
};
