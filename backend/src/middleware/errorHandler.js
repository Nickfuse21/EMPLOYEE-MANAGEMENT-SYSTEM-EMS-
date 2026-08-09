/**
 * Central error-handling middleware + 404 handler.
 *
 * Every error — thrown ApiError, Mongoose validation/duplicate errors, or an
 * unexpected bug — funnels through here and becomes a consistent JSON shape:
 *   { success: false, message, details? }
 */
import { ApiError } from '../utils/ApiError.js';
import { isProduction } from '../config/env.js';

/** Catch-all for unmatched routes → produces a 404 ApiError. */
export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature.
export function errorHandler(err, _req, res, _next) {
  let error = err;

  // Translate common Mongoose errors into friendly ApiErrors.
  if (err.name === 'ValidationError') {
    const details = Object.fromEntries(
      Object.values(err.errors).map((e) => [e.path, e.message]),
    );
    error = ApiError.badRequest('Validation failed', details);
  } else if (err.code === 11000) {
    // Duplicate unique key (e.g. email already exists).
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = ApiError.conflict(`An account with that ${field} already exists`);
  } else if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  } else if (err.type === 'entity.too.large') {
    // body-parser rejected an oversized payload. Without this branch it falls
    // through to the catch-all below and the client sees a misleading 500.
    error = new ApiError(413, 'Request body is too large');
  } else if (err.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Request body is not valid JSON');
  } else if (!(err instanceof ApiError)) {
    // Unknown/unexpected error → log it and hide internals from the client.
    console.error('❌ Unexpected error:', err);
    error = new ApiError(500, 'Something went wrong on our end');
  }

  const body = { success: false, message: error.message };
  if (error.details) body.details = error.details;
  // Expose the stack only in development to aid debugging.
  if (!isProduction && error.statusCode === 500) body.stack = err.stack;

  res.status(error.statusCode).json(body);
}
