/**
 * Wraps an async Express handler so that any thrown/rejected error is forwarded
 * to the central error middleware via `next()`. Removes the need for a
 * try/catch block in every controller.
 *
 * @param {Function} handler - async (req, res, next) => {...}
 */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
