/**
 * JWT helper functions. Kept separate from controllers so token behaviour
 * (payload shape, expiry, cookie options) is defined in exactly one place.
 */
import jwt from 'jsonwebtoken';
import { env, isProduction } from '../config/env.js';

/** Name of the http-only cookie that stores the access token. */
export const AUTH_COOKIE = 'ems_token';

/**
 * Signs a JWT containing the user's id and role. The role is embedded so the
 * auth middleware can authorise without an extra DB lookup on every request.
 */
export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

/** Verifies a token and returns its decoded payload, or throws if invalid. */
export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

/** Cookie options used when setting/clearing the auth cookie. */
export const cookieOptions = {
  httpOnly: true, // Not readable by JS → mitigates XSS token theft.
  secure: isProduction, // HTTPS-only in production.
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 1 day.
};
