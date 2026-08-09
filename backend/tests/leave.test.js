/**
 * Leave engine tests.
 *
 * The day count, the balance rules, and who may approve are the parts of an HR
 * system people notice when they are wrong — an employee losing two days of
 * entitlement to a weekend, or a colleague approving their own holiday.
 */
import { describe, expect, it } from 'vitest';
import { request, makeEmployee, makeActor, authHeader } from './helpers.js';
import { Holiday, toUtcMidnight } from '../src/models/Holiday.js';
import { LeaveRequest } from '../src/models/LeaveRequest.js';
import { countWorkingDays } from '../src/services/leaveCalendarService.js';
import { ROLES } from '../src/utils/roles.js';

/** 2026-08-03 is a Monday, which makes the weekday maths easy to read below. */
const MONDAY = '2026-08-03';
const FRIDAY = '2026-08-07';
const SATURDAY = '2026-08-08';
const SUNDAY = '2026-08-09';
const NEXT_MONDAY = '2026-08-10';

const apply = (header, body) => request.post('/api/leave').set(...header).send(body);

describe('countWorkingDays', () => {
  it('counts a Monday-to-Friday week as five days', async () => {
    const { days } = await countWorkingDays(MONDAY, FRIDAY);
    expect(days).toBe(5);
  });

  it('does not charge the weekend for a Friday-to-Monday absence', async () => {
    const { days, breakdown } = await countWorkingDays(FRIDAY, NEXT_MONDAY);

    // Four calendar days, but only Friday and Monday are working days.
    expect(breakdown.total).toBe(4);
    expect(breakdown.weekends).toBe(2);
    expect(days).toBe(2);
  });

  it('returns zero for a range that is entirely weekend', async () => {
    const { days } = await countWorkingDays(SATURDAY, SUNDAY);
    expect(days).toBe(0);
  });

  it('excludes a public holiday', async () => {
    await Holiday.create({ date: toUtcMidnight('2026-08-05'), name: 'Founders Day' });

    const { days, breakdown } = await countWorkingDays(MONDAY, FRIDAY);

    expect(breakdown.holidays).toBe(1);
    expect(days).toBe(4);
  });

  it('counts a single working day as one', async () => {
    expect((await countWorkingDays(MONDAY, MONDAY)).days).toBe(1);
  });
});

describe('POST /api/leave/preview', () => {
  it('explains which days were excluded and why', async () => {
    await Holiday.create({ date: toUtcMidnight('2026-08-05'), name: 'Founders Day' });
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await request
      .post('/api/leave/preview')
      .set(...header)
      .send({ startDate: MONDAY, endDate: NEXT_MONDAY });

    expect(res.status).toBe(200);
    expect(res.body.data.calendarDays).toBe(8);
    expect(res.body.data.workingDays).toBe(5); // 6 weekdays − 1 holiday.
    expect(res.body.data.excluded).toEqual(
      expect.arrayContaining([
        { date: '2026-08-05', reason: 'Founders Day' },
        { date: SATURDAY, reason: 'Weekend' },
        { date: SUNDAY, reason: 'Weekend' },
      ]),
    );
  });
});

describe('POST /api/leave (apply)', () => {
  it('charges working days only', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await apply(header, { type: 'annual', startDate: FRIDAY, endDate: NEXT_MONDAY });

    expect(res.status).toBe(201);
    expect(res.body.data.days).toBe(2);
    expect(res.body.data.calendarDays).toBe(4);
  });

  it('rejects a range with no working days in it', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await apply(header, { type: 'annual', startDate: SATURDAY, endDate: SUNDAY });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no working days/i);
  });

  it('rejects an end date before the start date', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await apply(header, { type: 'annual', startDate: FRIDAY, endDate: MONDAY });

    expect(res.status).toBe(400);
  });

  it('routes the request to the employee&apos;s reporting manager', async () => {
    const manager = await makeEmployee();
    const { user, header } = await makeActor(ROLES.EMPLOYEE, { reportingManager: manager._id });

    const res = await apply(header, { type: 'annual', startDate: MONDAY, endDate: FRIDAY });

    expect(res.status).toBe(201);
    expect(res.body.data.pendingWith.id).toBe(manager.id);
    expect(res.body.data.employee.id).toBe(user.id);
  });

  it('leaves the request with HR when the employee has no manager', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE, { reportingManager: null });

    const res = await apply(header, { type: 'annual', startDate: MONDAY, endDate: FRIDAY });

    expect(res.status).toBe(201);
    expect(res.body.data.pendingWith).toBeNull();
  });

  it('supports a half day on a single date', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await apply(header, {
      type: 'casual',
      startDate: MONDAY,
      endDate: MONDAY,
      halfDay: 'first_half',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.days).toBe(0.5);
  });

  it('rejects a half day spanning multiple dates', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await apply(header, {
      type: 'casual',
      startDate: MONDAY,
      endDate: FRIDAY,
      halfDay: 'first_half',
    });

    expect(res.status).toBe(400);
  });
});

describe('balance enforcement', () => {
  it('refuses a request larger than the remaining entitlement', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    // Casual allowance is 5 days; this asks for 10 working days.
    const res = await apply(header, {
      type: 'casual',
      startDate: MONDAY,
      endDate: '2026-08-14',
    });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/not enough casual leave/i);
  });

  it('counts pending requests against the balance', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    // 3 of 5 casual days, still awaiting a decision.
    await apply(header, { type: 'casual', startDate: MONDAY, endDate: '2026-08-05' }).expect(201);

    // 3 more would total 6 — over the allowance even though neither is approved.
    const second = await apply(header, {
      type: 'casual',
      startDate: '2026-08-17',
      endDate: '2026-08-19',
    });

    expect(second.status).toBe(422);
  });

  it('does not cap unpaid leave', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await apply(header, {
      type: 'unpaid',
      startDate: MONDAY,
      endDate: '2026-09-04',
    });

    expect(res.status).toBe(201);
  });

  it('reports allowance, used, pending and remaining', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);
    await apply(header, { type: 'casual', startDate: MONDAY, endDate: '2026-08-04' }).expect(201);

    const res = await request.get('/api/leave/balance').set(...header);
    const casual = res.body.data.find((b) => b.type === 'casual');

    expect(casual).toMatchObject({ allowance: 5, used: 0, pending: 2, remaining: 3 });
  });
});

describe('overlap detection', () => {
  it('rejects dates that overlap an existing request', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);
    await apply(header, { type: 'annual', startDate: MONDAY, endDate: FRIDAY }).expect(201);

    const overlapping = await apply(header, {
      type: 'annual',
      startDate: '2026-08-05',
      endDate: '2026-08-11',
    });

    expect(overlapping.status).toBe(409);
    expect(overlapping.body.message).toMatch(/overlap/i);
  });

  it('allows adjacent, non-overlapping ranges', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);
    await apply(header, { type: 'annual', startDate: MONDAY, endDate: FRIDAY }).expect(201);

    const adjacent = await apply(header, {
      type: 'annual',
      startDate: NEXT_MONDAY,
      endDate: '2026-08-14',
    });

    expect(adjacent.status).toBe(201);
  });

  it('ignores a cancelled request when checking for a clash', async () => {
    const { user, header } = await makeActor(ROLES.EMPLOYEE);
    const first = await apply(header, {
      type: 'annual',
      startDate: MONDAY,
      endDate: FRIDAY,
    }).expect(201);

    await request.patch(`/api/leave/${first.body.data.id}/cancel`).set(...header).expect(200);

    const again = await apply(header, { type: 'annual', startDate: MONDAY, endDate: FRIDAY });

    expect(again.status).toBe(201);
    expect(await LeaveRequest.countDocuments({ employee: user._id })).toBe(2);
  });
});

describe('PATCH /api/leave/:id/decision', () => {
  /** Sets up an employee reporting to a manager, with one pending request. */
  async function pendingRequest() {
    const manager = await makeEmployee();
    const { user, header } = await makeActor(ROLES.EMPLOYEE, { reportingManager: manager._id });
    const res = await apply(header, { type: 'annual', startDate: MONDAY, endDate: FRIDAY });
    return { manager, employee: user, employeeHeader: header, leaveId: res.body.data.id };
  }

  it('lets the assigned manager approve', async () => {
    const { manager, leaveId } = await pendingRequest();

    const res = await request
      .patch(`/api/leave/${leaveId}/decision`)
      .set(...authHeader(manager))
      .send({ decision: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.reviewedBy.id).toBe(manager.id);
  });

  it('drops the request out of the approval queue once decided', async () => {
    const { manager, leaveId } = await pendingRequest();

    await request
      .patch(`/api/leave/${leaveId}/decision`)
      .set(...authHeader(manager))
      .send({ decision: 'approved' })
      .expect(200);

    const inbox = await request
      .get('/api/leave')
      .set(...authHeader(manager))
      .query({ scope: 'inbox' });

    expect(inbox.body.data).toHaveLength(0);
  });

  it('lets HR override and decide any request', async () => {
    const { leaveId } = await pendingRequest();
    const { header } = await makeActor(ROLES.HR_MANAGER);

    const res = await request
      .patch(`/api/leave/${leaveId}/decision`)
      .set(...header)
      .send({ decision: 'rejected', reviewNote: 'Team is short-staffed that week' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
  });

  it('forbids an unrelated colleague from deciding', async () => {
    const { leaveId } = await pendingRequest();
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await request
      .patch(`/api/leave/${leaveId}/decision`)
      .set(...header)
      .send({ decision: 'approved' });

    expect(res.status).toBe(403);
  });

  it('forbids approving your own request, even as HR', async () => {
    const { user, header } = await makeActor(ROLES.HR_MANAGER);
    const created = await apply(header, {
      type: 'annual',
      startDate: MONDAY,
      endDate: FRIDAY,
    }).expect(201);

    const res = await request
      .patch(`/api/leave/${created.body.data.id}/decision`)
      .set(...header)
      .send({ decision: 'approved' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/your own/i);
    expect(created.body.data.employee.id).toBe(user.id);
  });

  it('refuses to decide a request twice', async () => {
    const { manager, leaveId } = await pendingRequest();
    const decide = () =>
      request
        .patch(`/api/leave/${leaveId}/decision`)
        .set(...authHeader(manager))
        .send({ decision: 'approved' });

    await decide().expect(200);
    expect((await decide()).status).toBe(400);
  });

  it('moves days from pending to used once approved', async () => {
    const { manager, employeeHeader, leaveId } = await pendingRequest();

    await request
      .patch(`/api/leave/${leaveId}/decision`)
      .set(...authHeader(manager))
      .send({ decision: 'approved' })
      .expect(200);

    const balance = await request.get('/api/leave/balance').set(...employeeHeader);
    const annual = balance.body.data.find((b) => b.type === 'annual');

    expect(annual).toMatchObject({ used: 5, pending: 0, remaining: 15 });
  });

  it('returns the days to the balance when rejected', async () => {
    const { manager, employeeHeader, leaveId } = await pendingRequest();

    await request
      .patch(`/api/leave/${leaveId}/decision`)
      .set(...authHeader(manager))
      .send({ decision: 'rejected' })
      .expect(200);

    const balance = await request.get('/api/leave/balance').set(...employeeHeader);
    const annual = balance.body.data.find((b) => b.type === 'annual');

    expect(annual).toMatchObject({ used: 0, pending: 0, remaining: 20 });
  });
});

describe('GET /api/leave (visibility)', () => {
  it("does not show an employee a colleague's leave", async () => {
    const { header: mine } = await makeActor(ROLES.EMPLOYEE);
    const { header: theirs } = await makeActor(ROLES.EMPLOYEE);

    await apply(theirs, { type: 'annual', startDate: MONDAY, endDate: FRIDAY }).expect(201);

    const res = await request.get('/api/leave').set(...mine);

    expect(res.body.data).toHaveLength(0);
  });

  it('shows a manager the requests awaiting their approval', async () => {
    const manager = await makeEmployee();
    const { header } = await makeActor(ROLES.EMPLOYEE, { reportingManager: manager._id });
    await apply(header, { type: 'annual', startDate: MONDAY, endDate: FRIDAY }).expect(201);

    const res = await request
      .get('/api/leave')
      .set(...authHeader(manager))
      .query({ scope: 'inbox' });

    expect(res.body.data).toHaveLength(1);
  });

  it('shows HR everything', async () => {
    const { header: employee } = await makeActor(ROLES.EMPLOYEE);
    await apply(employee, { type: 'annual', startDate: MONDAY, endDate: FRIDAY }).expect(201);
    const { header: hr } = await makeActor(ROLES.HR_MANAGER);

    const res = await request.get('/api/leave').set(...hr);

    expect(res.body.data).toHaveLength(1);
  });
});

describe('/api/holidays', () => {
  it('lets HR add a holiday', async () => {
    const { header } = await makeActor(ROLES.HR_MANAGER);

    const res = await request
      .post('/api/holidays')
      .set(...header)
      .send({ date: '2026-12-25', name: 'Christmas Day' });

    expect(res.status).toBe(201);
  });

  it('forbids a plain Employee adding a holiday', async () => {
    const { header } = await makeActor(ROLES.EMPLOYEE);

    const res = await request
      .post('/api/holidays')
      .set(...header)
      .send({ date: '2026-12-25', name: 'Christmas Day' });

    expect(res.status).toBe(403);
  });

  it('lets any authenticated user read the calendar', async () => {
    const { header: hr } = await makeActor(ROLES.HR_MANAGER);
    await request
      .post('/api/holidays')
      .set(...hr)
      .send({ date: '2026-12-25', name: 'Christmas Day' })
      .expect(201);

    const { header } = await makeActor(ROLES.EMPLOYEE);
    const res = await request.get('/api/holidays').set(...header).query({ year: 2026 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('rejects a duplicate holiday date', async () => {
    const { header } = await makeActor(ROLES.HR_MANAGER);
    const payload = { date: '2026-12-25', name: 'Christmas Day' };

    await request.post('/api/holidays').set(...header).send(payload).expect(201);
    const duplicate = await request.post('/api/holidays').set(...header).send(payload);

    expect(duplicate.status).toBe(409);
  });
});
