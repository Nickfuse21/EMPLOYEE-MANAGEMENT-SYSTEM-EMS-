/**
 * Authentication controller — login, logout, and "who am I".
 *
 * Passwords are verified with bcrypt (via the model's comparePassword method)
 * and a signed JWT is returned both in the response body and as an http-only
 * cookie, so the frontend can use whichever transport it prefers.
 */
import { Employee } from '../models/Employee.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken, cookieOptions, AUTH_COOKIE } from '../utils/token.js';
import { recordAudit } from '../services/auditService.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';

/** Consecutive failures before an account is temporarily locked. */
export const MAX_FAILED_LOGINS = 5;

/** How long a locked account stays locked. */
export const LOCKOUT_MINUTES = 15;

/**
 * POST /api/auth/login
 * Validates credentials and issues a JWT session.
 *
 * Two defences stack here. The IP rate limiter on the route stops one machine
 * hammering the endpoint; the per-account lockout below stops a *distributed*
 * attack against a single account, where each request comes from a different IP
 * and so never trips the rate limiter.
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // The hidden fields are `select: false`, so they must be requested explicitly.
  const user = await Employee.findOne({ email, isDeleted: false }).select(
    '+password +tokenVersion +failedLoginAttempts +lockedUntil',
  );

  // Locked accounts are rejected before the password is even checked, so a
  // lockout cannot be probed to confirm a correct password.
  if (user?.isLocked()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_BLOCKED,
      target: user,
      summary: `Login blocked — ${user.name}'s account is locked`,
      metadata: { email },
      ip: req.ip,
    });
    throw ApiError.tooManyRequests(
      `Account temporarily locked after too many failed attempts. Try again in ${minutesLeft} minute(s)`,
    );
  }

  // Use one generic message for both "no user" and "wrong password" so we don't
  // reveal which emails are registered.
  if (!user || !(await user.comparePassword(password))) {
    if (user) await registerFailedAttempt(user);

    // Log failed attempts too — a burst of these is a useful security signal.
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      summary: `Failed login attempt for ${email}`,
      metadata: { email },
      ip: req.ip,
    });
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.status === 'inactive') {
    throw ApiError.forbidden('Your account is inactive. Contact an administrator');
  }

  // Successful login clears the failure counter.
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await Employee.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: 0, lockedUntil: null } },
    );
  }

  const token = signToken(user);
  res.cookie(AUTH_COOKIE, token, cookieOptions);

  await recordAudit({
    action: AUDIT_ACTIONS.LOGIN,
    actor: user,
    summary: `${user.name} logged in`,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Logged in successfully',
    token, // Also returned in-body for header-based clients.
    user: user.toJSON(),
  });
});

/**
 * Records one failed attempt and locks the account once the threshold is hit.
 * Uses `$inc` so concurrent attempts each count exactly once.
 */
async function registerFailedAttempt(user) {
  const attempts = (user.failedLoginAttempts || 0) + 1;
  const update = { $inc: { failedLoginAttempts: 1 } };

  if (attempts >= MAX_FAILED_LOGINS) {
    update.$set = { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) };
  }
  await Employee.updateOne({ _id: user._id }, update);
}

/**
 * POST /api/auth/logout
 * Clears the auth cookie. (JWTs are stateless, so this simply drops the cookie.)
 */
export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: 0 });
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * POST /api/auth/logout-all
 * Revokes every session for the current user by bumping their token version, so
 * tokens already handed out (including any an attacker holds) stop working
 * immediately rather than lasting until they expire.
 */
export const logoutEverywhere = asyncHandler(async (req, res) => {
  await Employee.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: 0 });

  await recordAudit({
    action: AUDIT_ACTIONS.SESSIONS_REVOKED,
    actor: req.user,
    target: req.user,
    summary: `${req.user.name} signed out of all devices`,
    ip: req.ip,
  });

  res.json({ success: true, message: 'All sessions have been signed out' });
});

/**
 * POST /api/auth/change-password
 * Lets the signed-in user rotate their own password. Requires the current
 * password, so a hijacked session cannot lock the real owner out. Saving a new
 * password revokes every existing session (see the Employee model).
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await Employee.findById(req.user._id).select('+password');
  if (!user || !(await user.comparePassword(currentPassword))) {
    throw ApiError.unauthorized('Your current password is incorrect');
  }
  if (await user.comparePassword(newPassword)) {
    throw ApiError.badRequest('Your new password must be different from the current one');
  }

  user.password = newPassword; // Hashed by the model's pre-save hook.
  await user.save();

  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: 0 });

  await recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    actor: user,
    target: user,
    summary: `${user.name} changed their password`,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Password updated. Please log in again',
  });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user (used by the frontend on load to
 * restore the session).
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await Employee.findById(req.user._id).populate(
    'reportingManager',
    'name email employeeId designation',
  );
  res.json({ success: true, user });
});
