/**
 * Authentication middleware.
 *
 * Reads the JWT from either the http-only cookie or the `Authorization: Bearer`
 * header, verifies it, loads the current user, and attaches it to `req.user`.
 * Any protected route mounts this before its handler.
 */
import { Employee } from '../models/Employee.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken, AUTH_COOKIE } from '../utils/token.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  // Prefer the secure cookie; fall back to the Authorization header (useful
  // for API clients / tests that cannot store cookies).
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.[AUTH_COOKIE] || bearer;

  if (!token) {
    throw ApiError.unauthorized('You are not logged in');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired session. Please log in again');
  }

  // Load the live user so a deleted/deactivated account cannot keep using an
  // otherwise-valid token.
  const user = await Employee.findOne({ _id: payload.sub, isDeleted: false }).select(
    '+tokenVersion',
  );
  if (!user) {
    throw ApiError.unauthorized('The account for this session no longer exists');
  }
  if (user.status === 'inactive') {
    throw ApiError.forbidden('Your account is inactive. Contact an administrator');
  }

  // Reject tokens issued before the user's sessions were last revoked (password
  // change, "log out everywhere"). Tokens signed before this field existed carry
  // no `ver` claim, so they are treated as version 0.
  if ((payload.ver ?? 0) !== user.tokenVersion) {
    throw ApiError.unauthorized('This session has been revoked. Please log in again');
  }

  req.user = user;
  next();
});
