/**
 * Shared test helpers — factories and request utilities.
 *
 * Tests authenticate by signing a token directly rather than by POSTing to
 * /api/auth/login. That keeps every other suite independent of the login
 * endpoint (and of its rate limiter); the login flow itself is covered by
 * auth.test.js.
 */
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { Employee } from '../src/models/Employee.js';
import { signToken } from '../src/utils/token.js';
import { ROLES } from '../src/utils/roles.js';

/** A ready-to-use supertest client bound to a fresh app instance. */
export const request = supertest(createApp());

let uniqueCounter = 0;

/**
 * Creates an employee. Any field can be overridden; the rest get sane defaults
 * and a unique email so callers never collide.
 *
 * @param {object} [overrides]
 * @returns {Promise<import('mongoose').Document>}
 */
export async function makeEmployee(overrides = {}) {
  uniqueCounter += 1;
  return Employee.create({
    name: `Test User ${uniqueCounter}`,
    email: `user${uniqueCounter}@ems.test`,
    password: 'Password@123',
    role: ROLES.EMPLOYEE,
    department: 'Engineering',
    designation: 'Engineer',
    salary: 50000,
    ...overrides,
  });
}

/** Creates a Super Admin. */
export const makeSuperAdmin = (overrides = {}) =>
  makeEmployee({ role: ROLES.SUPER_ADMIN, ...overrides });

/** Creates an HR Manager. */
export const makeHrManager = (overrides = {}) =>
  makeEmployee({ role: ROLES.HR_MANAGER, ...overrides });

/**
 * Returns the `Authorization` header value for a user document.
 * Usage: `request.get('/api/employees').set(...authHeader(admin))`
 */
export function authHeader(user) {
  return ['Authorization', `Bearer ${signToken(user)}`];
}

/**
 * Creates a user of the given role and returns both the document and a
 * pre-built auth header — the common "I need a logged-in X" case.
 */
export async function makeActor(role, overrides = {}) {
  const user = await makeEmployee({ role, ...overrides });
  return { user, header: authHeader(user) };
}
