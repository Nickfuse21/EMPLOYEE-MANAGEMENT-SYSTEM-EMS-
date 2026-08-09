/**
 * RBAC boundary tests for /api/employees.
 *
 * These are the tests that matter most in an HR system: they assert what each
 * role *cannot* do. A permission bug here leaks salaries or lets someone
 * escalate their own access, so every deny path is covered explicitly.
 */
import { describe, expect, it } from 'vitest';
import { request, makeEmployee, makeActor } from './helpers.js';
import { Employee } from '../src/models/Employee.js';
import { ROLES } from '../src/utils/roles.js';

describe('GET /api/employees (list)', () => {
  it('is allowed for a Super Admin', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    await makeEmployee();

    const res = await request.get('/api/employees').set(...header);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 10 });
  });

  it('is allowed for an HR Manager', async () => {
    const { header } = await makeActor(ROLES.HR_MANAGER);

    expect((await request.get('/api/employees').set(...header)).status).toBe(200);
  });

  it('is forbidden for a plain Employee', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await request.get('/api/employees').set(...header);

    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    expect((await request.get('/api/employees')).status).toBe(401);
  });

  it('excludes soft-deleted employees', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    await makeEmployee({ name: 'Visible Person' });
    await makeEmployee({ name: 'Hidden Person', isDeleted: true });

    const res = await request.get('/api/employees').set(...header);
    const names = res.body.data.map((e) => e.name);

    expect(names).toContain('Visible Person');
    expect(names).not.toContain('Hidden Person');
  });
});

describe('GET /api/employees/:id (read one)', () => {
  it('lets an Employee read their own record', async () => {
    const { user, header } = await makeActor(ROLES.EMPLOYEE);

    const res = await request.get(`/api/employees/${user.id}`).set(...header);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
  });

  it("forbids an Employee reading a colleague's record", async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);
    const colleague = await makeEmployee();

    const res = await request.get(`/api/employees/${colleague.id}`).set(...header);

    expect(res.status).toBe(403);
  });

  it('lets HR read anyone', async () => {
    const { header } = await makeActor(ROLES.HR_MANAGER);
    const other = await makeEmployee();

    expect((await request.get(`/api/employees/${other.id}`).set(...header)).status).toBe(200);
  });

  it('returns 404 for a soft-deleted employee', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    const deleted = await makeEmployee({ isDeleted: true });

    expect((await request.get(`/api/employees/${deleted.id}`).set(...header)).status).toBe(404);
  });
});

describe('POST /api/employees (create)', () => {
  const newEmployee = (overrides = {}) => ({
    name: 'Fresh Hire',
    email: `hire-${Math.random().toString(36).slice(2)}@ems.test`,
    password: 'Password@123',
    department: 'Sales',
    ...overrides,
  });

  it('lets a Super Admin create an employee', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);

    const res = await request.post('/api/employees').set(...header).send(newEmployee());

    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toMatch(/^EMP-\d{4}$/);
  });

  it('forbids a plain Employee creating anyone', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await request.post('/api/employees').set(...header).send(newEmployee());

    expect(res.status).toBe(403);
  });

  it('forbids HR minting a Super Admin', async () => {
    const { header } = await makeActor(ROLES.HR_MANAGER);

    const res = await request
      .post('/api/employees')
      .set(...header)
      .send(newEmployee({ role: ROLES.SUPER_ADMIN }));

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  it('allows a Super Admin to create another Super Admin', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);

    const res = await request
      .post('/api/employees')
      .set(...header)
      .send(newEmployee({ role: ROLES.SUPER_ADMIN }));

    expect(res.status).toBe(201);
  });

  it('rejects a duplicate email with 409', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    await makeEmployee({ email: 'taken@ems.test' });

    const res = await request
      .post('/api/employees')
      .set(...header)
      .send(newEmployee({ email: 'taken@ems.test' }));

    expect(res.status).toBe(409);
  });

  it('rejects a weak password', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);

    const res = await request
      .post('/api/employees')
      .set(...header)
      .send(newEmployee({ password: '123456' }));

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('password');
  });

  it('rejects an unknown reporting manager', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);

    const res = await request
      .post('/api/employees')
      .set(...header)
      .send(newEmployee({ reportingManager: '507f1f77bcf86cd799439011' }));

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/employees/:id (update)', () => {
  it('lets an Employee edit their own name', async () => {
    const { user, header } = await makeActor(ROLES.EMPLOYEE);

    const res = await request
      .put(`/api/employees/${user.id}`)
      .set(...header)
      .send({ name: 'Renamed Self' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Self');
  });

  it('silently ignores an Employee trying to raise their own salary', async () => {
    const { user, header } = await makeActor(ROLES.EMPLOYEE, { salary: 50000 });

    await request
      .put(`/api/employees/${user.id}`)
      .set(...header)
      .send({ name: 'Still Me', salary: 999999 })
      .expect(200);

    const fresh = await Employee.findById(user._id);
    expect(fresh.salary).toBe(50000);
  });

  it('silently ignores an Employee trying to promote themselves', async () => {
    const { user, header } = await makeActor(ROLES.EMPLOYEE);

    await request
      .put(`/api/employees/${user.id}`)
      .set(...header)
      .send({ role: ROLES.SUPER_ADMIN })
      .expect(200);

    const fresh = await Employee.findById(user._id);
    expect(fresh.role).toBe(ROLES.EMPLOYEE);
  });

  it("forbids an Employee editing a colleague's record", async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);
    const colleague = await makeEmployee();

    const res = await request
      .put(`/api/employees/${colleague.id}`)
      .set(...header)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('forbids HR promoting anyone to Super Admin', async () => {
    const { header } = await makeActor(ROLES.HR_MANAGER);
    const target = await makeEmployee();

    const res = await request
      .put(`/api/employees/${target.id}`)
      .set(...header)
      .send({ role: ROLES.SUPER_ADMIN });

    expect(res.status).toBe(403);
  });

  it('forbids HR modifying a Super Admin account', async () => {
    const { header } = await makeActor(ROLES.HR_MANAGER);
    const admin = await makeEmployee({ role: ROLES.SUPER_ADMIN });

    const res = await request
      .put(`/api/employees/${admin.id}`)
      .set(...header)
      .send({ name: 'Demoted' });

    expect(res.status).toBe(403);
  });

  it('lets a Super Admin change salary and role', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    const target = await makeEmployee({ salary: 40000 });

    const res = await request
      .put(`/api/employees/${target.id}`)
      .set(...header)
      .send({ salary: 60000, role: ROLES.HR_MANAGER });

    expect(res.status).toBe(200);
    expect(res.body.data.salary).toBe(60000);
    expect(res.body.data.role).toBe(ROLES.HR_MANAGER);
  });

  it('rejects a reporting-manager cycle', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    const manager = await makeEmployee();
    const report = await makeEmployee({ reportingManager: manager._id });

    // Making the manager report to their own report would close a loop.
    const res = await request
      .put(`/api/employees/${manager.id}`)
      .set(...header)
      .send({ reportingManager: report.id });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/employees/:id', () => {
  it('is forbidden for HR', async () => {
    const { header } = await makeActor(ROLES.HR_MANAGER);
    const target = await makeEmployee();

    expect((await request.delete(`/api/employees/${target.id}`).set(...header)).status).toBe(403);
  });

  it('is forbidden for a plain Employee', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);
    const target = await makeEmployee();

    expect((await request.delete(`/api/employees/${target.id}`).set(...header)).status).toBe(403);
  });

  it('soft-deletes rather than destroying the record', async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    const target = await makeEmployee();

    await request.delete(`/api/employees/${target.id}`).set(...header).expect(200);

    const fresh = await Employee.findById(target._id);
    expect(fresh).not.toBeNull(); // Still there for audit/history.
    expect(fresh.isDeleted).toBe(true);
    expect(fresh.status).toBe('inactive');
  });

  it('refuses to let a Super Admin delete themselves', async () => {
    const { user, header } = await makeActor(ROLES.SUPER_ADMIN);

    const res = await request.delete(`/api/employees/${user.id}`).set(...header);

    expect(res.status).toBe(400);
  });

  it("re-parents the deleted employee's direct reports", async () => {
    const { header } = await makeActor(ROLES.SUPER_ADMIN);
    const director = await makeEmployee();
    const manager = await makeEmployee({ reportingManager: director._id });
    const report = await makeEmployee({ reportingManager: manager._id });

    await request.delete(`/api/employees/${manager.id}`).set(...header).expect(200);

    const fresh = await Employee.findById(report._id);
    expect(fresh.reportingManager.toString()).toBe(director.id);
  });
});

describe('token forgery', () => {
  it('rejects a token signed with the wrong secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const user = await makeEmployee({ role: ROLES.EMPLOYEE });
    const forged = jwt.sign({ sub: user.id, role: ROLES.SUPER_ADMIN }, 'attacker-secret');

    const res = await request.get('/api/employees').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('uses the database role, not the role claimed in the token', async () => {
    const user = await makeEmployee({ role: ROLES.EMPLOYEE });
    // Correctly signed, but claiming a role the user does not have.
    const jwt = (await import('jsonwebtoken')).default;
    const token = jwt.sign(
      { sub: user.id, role: ROLES.SUPER_ADMIN, ver: 0 },
      process.env.JWT_SECRET,
    );

    const res = await request.get('/api/employees').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403); // Authenticated, but authorised from the DB record.
  });
});
