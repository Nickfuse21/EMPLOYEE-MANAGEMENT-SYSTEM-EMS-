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

/**
 * POST /api/auth/login
 * Validates credentials and issues a JWT session.
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // `.select('+password')` is required because the field is hidden by default.
  const user = await Employee.findOne({ email, isDeleted: false }).select('+password');

  // Use one generic message for both "no user" and "wrong password" so we don't
  // reveal which emails are registered.
  if (!user || !(await user.comparePassword(password))) {
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
 * POST /api/auth/logout
 * Clears the auth cookie. (JWTs are stateless, so this simply drops the cookie.)
 */
export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: 0 });
  res.json({ success: true, message: 'Logged out successfully' });
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
