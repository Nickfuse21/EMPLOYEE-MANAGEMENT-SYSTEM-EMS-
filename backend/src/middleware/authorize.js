/**
 * Role-Based Access Control (RBAC) middleware.
 *
 * `authorize(...roles)` returns a guard that only lets through users whose role
 * is in the allowed list. Must run *after* `authenticate` (which sets req.user).
 *
 * Example:  router.delete('/:id', authorize(ROLES.SUPER_ADMIN), handler)
 */
import { ApiError } from '../utils/ApiError.js';

export const authorize =
  (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden('Your role does not have access to this resource'),
      );
    }
    next();
  };
