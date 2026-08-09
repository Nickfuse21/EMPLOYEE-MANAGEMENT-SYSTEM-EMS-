/**
 * Regression tests for the hardening work.
 *
 * Each block below pins a specific defect that was fixed, so the fix cannot be
 * undone silently: regex injection in search, ID collisions under concurrency,
 * missing security headers, and the rate limiters.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { request, makeEmployee, makeActor } from './helpers.js';
import { Employee } from '../src/models/Employee.js';
import { Ticket } from '../src/models/Ticket.js';
import { escapeRegex, containsMatcher } from '../src/utils/sanitize.js';
import { ROLES } from '../src/utils/roles.js';

describe('regex escaping', () => {
  it('escapes every metacharacter', () => {
    expect(escapeRegex('a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o')).toBe(
      'a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\|l\\[m\\]n\\\\o',
    );
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeRegex('Priya Sharma')).toBe('Priya Sharma');
  });

  it('caps the term length so a huge input cannot make the scan pathological', () => {
    expect(containsMatcher('a'.repeat(5000)).$regex).toHaveLength(100);
  });
});

describe('GET /api/employees?search=', () => {
  it('treats a wildcard as literal text rather than a pattern', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    await makeEmployee({ name: 'Ordinary Person' });

    // Unescaped, `.*` would match every employee in the collection.
    const res = await request.get('/api/employees').set(...header).query({ search: '.*' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('does not hang on a catastrophically-backtracking pattern', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    await makeEmployee({ name: `${'a'.repeat(40)}!` });

    const startedAt = Date.now();
    const res = await request
      .get('/api/employees')
      .set(...header)
      .query({ search: '(a+)+$' });

    expect(res.status).toBe(200);
    // Escaped, this is a plain substring search and returns immediately.
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });

  it('still finds a genuine substring match', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    await makeEmployee({ name: 'Findable Human' });

    const res = await request.get('/api/employees').set(...header).query({ search: 'findable' });

    expect(res.body.data.map((e) => e.name)).toContain('Findable Human');
  });
});

describe('sequential reference IDs', () => {
  it('assigns unique employee IDs to concurrent creates', async () => {
    // The previous count-based implementation gave all of these the same ID.
    const created = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        Employee.create({
          name: `Concurrent ${i}`,
          email: `concurrent-${i}@ems.test`,
          password: 'Password@123',
        }),
      ),
    );

    const ids = created.map((e) => e.employeeId);
    expect(new Set(ids).size).toBe(12);
    expect(ids.every((id) => /^EMP-\d{4}$/.test(id))).toBe(true);
  });

  it('does not re-issue an employee ID after a delete', async () => {
    const first = await makeEmployee();
    await Employee.deleteOne({ _id: first._id }); // Hard delete, worst case.
    const second = await makeEmployee();

    expect(second.employeeId).not.toBe(first.employeeId);
  });

  it('assigns unique ticket IDs to concurrent creates', async () => {
    const raiser = await makeEmployee();
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        Ticket.create({
          subject: `Concurrent ticket ${i}`,
          description: 'Raised at the same moment as several others.',
          raisedBy: raiser._id,
        }),
      ),
    );

    expect(new Set(created.map((t) => t.ticketId)).size).toBe(8);
  });
});

describe('security headers', () => {
  it('sets the headers helmet is responsible for', async () => {
    const res = await request.get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('does not advertise the server framework', async () => {
    const res = await request.get('/api/health');

    expect(res.headers).not.toHaveProperty('x-powered-by');
  });
});

describe('request body limits', () => {
  it('rejects an oversized payload', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);

    const res = await request
      .post('/api/employees')
      .set(...header)
      .send({
        name: 'Huge Payload',
        email: 'huge@ems.test',
        password: 'Password@123',
        profileImage: 'x'.repeat(3 * 1024 * 1024), // 3 MB, over the 2 MB cap.
      });

    expect(res.status).toBe(413);
  });

  it('rejects a profile image over the field limit', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);

    const res = await request
      .post('/api/employees')
      .set(...header)
      .send({
        name: 'Big Avatar',
        email: 'avatar@ems.test',
        password: 'Password@123',
        profileImage: 'x'.repeat(1_600_000),
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('profileImage');
  });
});

describe('rate limiting', () => {
  // The limiters are disabled for the rest of the suite so other tests can make
  // as many requests as they need; this block turns them on deliberately.
  beforeAll(() => {
    process.env.ENABLE_RATE_LIMIT = '1';
  });
  afterAll(() => {
    delete process.env.ENABLE_RATE_LIMIT;
  });

  it('blocks repeated failed logins from one client with 429', async () => {
    await makeEmployee({ email: 'flood@ems.test', password: 'Password@123' });

    const statuses = [];
    for (let i = 0; i < 8; i += 1) {
      const res = await request.post('/api/auth/login').send({
        email: 'flood@ems.test',
        password: 'Wrong@12345',
      });
      statuses.push(res.status);
    }

    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    // The first few attempts still get a normal auth failure.
    expect(statuses[0]).toBe(401);
  });

  it('leaves the health check unthrottled', async () => {
    for (let i = 0; i < 20; i += 1) {
      expect((await request.get('/api/health')).status).toBe(200);
    }
  });
});
