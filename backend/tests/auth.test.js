/**
 * Authentication tests — login, session revocation, lockout, password rotation.
 */
import { describe, expect, it } from 'vitest';
import { request, makeEmployee, authHeader } from './helpers.js';
import { Employee } from '../src/models/Employee.js';
import { AuditLog, AUDIT_ACTIONS } from '../src/models/AuditLog.js';
import { MAX_FAILED_LOGINS } from '../src/controllers/authController.js';

const PASSWORD = 'Password@123';

/** Posts a login attempt for the given credentials. */
const attemptLogin = (email, password) =>
  request.post('/api/auth/login').send({ email, password });

describe('POST /api/auth/login', () => {
  it('issues a token and returns the user for valid credentials', async () => {
    const user = await makeEmployee({ email: 'valid@ems.test', password: PASSWORD });

    const res = await attemptLogin('valid@ems.test', PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.id).toBe(user.id);
  });

  it('never returns the password hash or the security columns', async () => {
    await makeEmployee({ email: 'leak@ems.test', password: PASSWORD });

    const res = await attemptLogin('leak@ems.test', PASSWORD);

    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('tokenVersion');
    expect(res.body.user).not.toHaveProperty('failedLoginAttempts');
    expect(res.body.user).not.toHaveProperty('lockedUntil');
  });

  it('sets an http-only auth cookie', async () => {
    await makeEmployee({ email: 'cookie@ems.test', password: PASSWORD });

    const res = await attemptLogin('cookie@ems.test', PASSWORD);
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('ems_token='));

    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
  });

  it('gives the same message for an unknown email and a wrong password', async () => {
    await makeEmployee({ email: 'known@ems.test', password: PASSWORD });

    const wrongPassword = await attemptLogin('known@ems.test', 'Wrong@12345');
    const unknownEmail = await attemptLogin('nobody@ems.test', PASSWORD);

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Identical wording — otherwise the endpoint confirms which emails exist.
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('refuses an inactive account', async () => {
    await makeEmployee({ email: 'inactive@ems.test', password: PASSWORD, status: 'inactive' });

    const res = await attemptLogin('inactive@ems.test', PASSWORD);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/inactive/i);
  });

  it('refuses a soft-deleted account', async () => {
    await makeEmployee({ email: 'gone@ems.test', password: PASSWORD, isDeleted: true });

    const res = await attemptLogin('gone@ems.test', PASSWORD);

    expect(res.status).toBe(401);
  });

  it('records failed attempts in the audit log', async () => {
    await makeEmployee({ email: 'audited@ems.test', password: PASSWORD });

    await attemptLogin('audited@ems.test', 'Wrong@12345');

    const entries = await AuditLog.find({ action: AUDIT_ACTIONS.LOGIN_FAILED });
    expect(entries).toHaveLength(1);
    expect(entries[0].metadata.email).toBe('audited@ems.test');
  });
});

describe('account lockout', () => {
  it(`locks the account after ${MAX_FAILED_LOGINS} consecutive failures`, async () => {
    await makeEmployee({ email: 'target@ems.test', password: PASSWORD });

    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      const res = await attemptLogin('target@ems.test', 'Wrong@12345');
      expect(res.status).toBe(401); // Still just "invalid" while under the limit.
    }

    // The next attempt is refused before the password is even checked — so even
    // the *correct* password is rejected while the lock holds.
    const locked = await attemptLogin('target@ems.test', PASSWORD);
    expect(locked.status).toBe(429);
    expect(locked.body.message).toMatch(/locked/i);
  });

  it('clears the failure counter after a successful login', async () => {
    const user = await makeEmployee({ email: 'recover@ems.test', password: PASSWORD });

    await attemptLogin('recover@ems.test', 'Wrong@12345');
    await attemptLogin('recover@ems.test', 'Wrong@12345');
    await attemptLogin('recover@ems.test', PASSWORD);

    const fresh = await Employee.findById(user._id).select('+failedLoginAttempts');
    expect(fresh.failedLoginAttempts).toBe(0);
  });

  it('lets the user back in once the lock expires', async () => {
    const user = await makeEmployee({ email: 'expired@ems.test', password: PASSWORD });
    // Simulate a lock that has already elapsed.
    await Employee.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: MAX_FAILED_LOGINS, lockedUntil: new Date(Date.now() - 1000) } },
    );

    const res = await attemptLogin('expired@ems.test', PASSWORD);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the caller for a valid token', async () => {
    const user = await makeEmployee();

    const res = await request.get('/api/auth/me').set(...authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it('rejects a request with no token', async () => {
    const res = await request.get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request.get('/api/auth/me').set('Authorization', 'Bearer not.a.jwt');

    expect(res.status).toBe(401);
  });

  it('rejects a token whose account was deleted after it was issued', async () => {
    const user = await makeEmployee();
    const header = authHeader(user);
    await Employee.updateOne({ _id: user._id }, { isDeleted: true });

    const res = await request.get('/api/auth/me').set(...header);

    expect(res.status).toBe(401);
  });

  it('rejects a token whose account was deactivated after it was issued', async () => {
    const user = await makeEmployee();
    const header = authHeader(user);
    await Employee.updateOne({ _id: user._id }, { status: 'inactive' });

    const res = await request.get('/api/auth/me').set(...header);

    expect(res.status).toBe(403);
  });
});

describe('session revocation', () => {
  it('invalidates existing tokens after POST /api/auth/logout-all', async () => {
    const user = await makeEmployee();
    const header = authHeader(user);

    expect((await request.get('/api/auth/me').set(...header)).status).toBe(200);

    await request.post('/api/auth/logout-all').set(...header).expect(200);

    const after = await request.get('/api/auth/me').set(...header);
    expect(after.status).toBe(401);
    expect(after.body.message).toMatch(/revoked/i);
  });

  it('invalidates existing tokens when the password changes', async () => {
    const user = await makeEmployee({ email: 'rotate@ems.test', password: PASSWORD });
    const header = authHeader(user);

    await request
      .post('/api/auth/change-password')
      .set(...header)
      .send({ currentPassword: PASSWORD, newPassword: 'Brand@NewPass9' })
      .expect(200);

    // The old session is dead...
    expect((await request.get('/api/auth/me').set(...header)).status).toBe(401);
    // ...and the new password works.
    expect((await attemptLogin('rotate@ems.test', 'Brand@NewPass9')).status).toBe(200);
  });
});

describe('POST /api/auth/change-password', () => {
  it('rejects a wrong current password', async () => {
    const user = await makeEmployee({ password: PASSWORD });

    const res = await request
      .post('/api/auth/change-password')
      .set(...authHeader(user))
      .send({ currentPassword: 'Nope@123456', newPassword: 'Brand@NewPass9' });

    expect(res.status).toBe(401);
  });

  it('rejects reusing the current password', async () => {
    const user = await makeEmployee({ password: PASSWORD });

    const res = await request
      .post('/api/auth/change-password')
      .set(...authHeader(user))
      .send({ currentPassword: PASSWORD, newPassword: PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/different/i);
  });

  it.each([
    ['too short', 'Ab@1'],
    ['no uppercase', 'lowercase@123'],
    ['no number', 'NoDigitsHere@'],
    ['no symbol', 'NoSymbols12345'],
    ['a common password', 'Password123'],
  ])('rejects a new password that is %s', async (_label, newPassword) => {
    const user = await makeEmployee({ password: PASSWORD });

    const res = await request
      .post('/api/auth/change-password')
      .set(...authHeader(user))
      .send({ currentPassword: PASSWORD, newPassword });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('newPassword');
  });

  it('requires authentication', async () => {
    const res = await request
      .post('/api/auth/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'Brand@NewPass9' });

    expect(res.status).toBe(401);
  });
});
