/**
 * Smoke tests — proves the app boots, the harness is wired to a live database,
 * and the 404 / error-shape contract holds.
 */
import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { request, makeEmployee } from './helpers.js';

describe('infrastructure', () => {
  it('is connected to the in-memory test database', () => {
    expect(mongoose.connection.readyState).toBe(1);
    expect(mongoose.connection.name).toMatch(/^ems_test_/);
  });

  it('starts each test with an empty database', async () => {
    const { Employee } = await import('../src/models/Employee.js');
    expect(await Employee.countDocuments()).toBe(0);
    await makeEmployee();
    expect(await Employee.countDocuments()).toBe(1);
  });
});

describe('GET /api/health', () => {
  it('reports ok without authentication', async () => {
    const res = await request.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: 'ok' });
    expect(Date.parse(res.body.timestamp)).not.toBeNaN();
  });
});

describe('unknown routes', () => {
  it('returns a 404 in the standard error shape', async () => {
    const res = await request.get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Route not found');
  });
});
