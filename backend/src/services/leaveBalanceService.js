/**
 * Leave balance and eligibility rules.
 *
 * Balance is *derived* from requests rather than stored as a counter, so it can
 * never drift out of sync with the underlying records. Two kinds of day are
 * subtracted from an entitlement:
 *
 *   • approved  — days already taken.
 *   • pending   — days requested but not yet decided.
 *
 * Pending days must count against the balance. If they don't, an employee can
 * submit ten separate requests that are each individually affordable and have
 * them all approved, ending the year well over their entitlement — the classic
 * double-spend, and the reason a "remaining" figure that ignores pending
 * requests is misleading to both the employee and the approver.
 */
import { LeaveRequest, LEAVE_ALLOWANCE } from '../models/LeaveRequest.js';
import { ApiError } from '../utils/ApiError.js';

/** Types that draw down an entitlement. Anything else (unpaid) is uncapped. */
export const CAPPED_TYPES = Object.keys(LEAVE_ALLOWANCE);

/** UTC start/end of the leave year containing `reference` (calendar year). */
export function leaveYearBounds(reference = new Date()) {
  const year = new Date(reference).getUTCFullYear();
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    year,
  };
}

/**
 * Computes the balance per capped leave type for one employee in one leave year.
 *
 * @returns {Promise<Array<{type, allowance, used, pending, remaining}>>}
 */
export async function computeBalance(employeeId, reference = new Date()) {
  const { start, end } = leaveYearBounds(reference);

  const rows = await LeaveRequest.aggregate([
    {
      $match: {
        employee: employeeId,
        status: { $in: ['approved', 'pending'] },
        startDate: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: { type: '$type', status: '$status' }, days: { $sum: '$days' } } },
  ]);

  const totals = {};
  for (const row of rows) {
    const bucket = (totals[row._id.type] ||= { approved: 0, pending: 0 });
    bucket[row._id.status] = row.days;
  }

  return Object.entries(LEAVE_ALLOWANCE).map(([type, allowance]) => {
    const { approved = 0, pending = 0 } = totals[type] || {};
    return {
      type,
      allowance,
      used: approved,
      pending,
      // Committed days are approved + pending, so the figure shown is what the
      // employee can still safely request.
      remaining: Math.max(0, allowance - approved - pending),
    };
  });
}

/**
 * Throws unless the employee has enough remaining entitlement for `days` of
 * `type`. Uncapped types always pass.
 */
export async function assertSufficientBalance(employeeId, type, days, reference = new Date()) {
  if (!CAPPED_TYPES.includes(type)) return;

  const balance = await computeBalance(employeeId, reference);
  const entry = balance.find((b) => b.type === type);

  if (days > entry.remaining) {
    throw ApiError.unprocessable(
      `Not enough ${type} leave: ${days} day(s) requested but only ${entry.remaining} remaining ` +
        `(${entry.allowance} allowance − ${entry.used} taken − ${entry.pending} pending)`,
    );
  }
}

/**
 * Throws if the employee already has a pending or approved request overlapping
 * the given range.
 *
 * Two ranges overlap when each starts on or before the other ends. Without this
 * check the same days can be booked twice, which corrupts the balance and puts
 * contradictory information in front of the approver.
 */
export async function assertNoOverlap(employeeId, startDate, endDate, { excludeId } = {}) {
  const filter = {
    employee: employeeId,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: new Date(endDate) },
    endDate: { $gte: new Date(startDate) },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await LeaveRequest.findOne(filter).select('startDate endDate type status');
  if (clash) {
    const from = clash.startDate.toISOString().slice(0, 10);
    const to = clash.endDate.toISOString().slice(0, 10);
    throw ApiError.conflict(
      `These dates overlap an existing ${clash.status} ${clash.type} request (${from} → ${to})`,
    );
  }
}
