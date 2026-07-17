/**
 * Attrition ("flight risk") scoring service.
 *
 * IMPORTANT — this is a TRANSPARENT, RULE-BASED heuristic, not a machine-learning
 * model. Every point in an employee's score comes from a named factor with a
 * clear reason, so HR can see *why* someone is flagged and the whole thing can be
 * explained in one sentence. It reads only data the system already has (salary vs
 * department median, leave usage, open helpdesk tickets, tenure).
 *
 * Score is 0–100, split into bands:  low (<34) · medium (34–66) · high (>66).
 */
import { Employee } from '../models/Employee.js';
import { LeaveRequest, LEAVE_ALLOWANCE } from '../models/LeaveRequest.js';
import { Ticket } from '../models/Ticket.js';

/** Maximum points each factor can contribute (documents the weighting up-front). */
const WEIGHTS = Object.freeze({
  belowMarketPay: 30, // Paid noticeably below the department median.
  highLeaveUsage: 20, // Burned through most of the annual leave allowance.
  unpaidLeave: 15, // Took unpaid leave (often a stop-gap while job-hunting).
  openTickets: 15, // Unresolved HR/payroll/IT complaints — a frustration signal.
  tenureStagnation: 20, // Long tenure with no role change (promotion-gap proxy).
});

const DAY = 1000 * 60 * 60 * 24;

/** Median of a numeric array (0 for empty). */
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Bucket a raw 0–100 score into a band label. */
function band(score) {
  if (score > 66) return 'high';
  if (score >= 34) return 'medium';
  return 'low';
}

/**
 * Compute attrition risk for every active employee, sorted highest-risk first.
 * Returns [{ employee, score, band, factors: [{ label, points }] }].
 */
export async function computeAttritionRisks() {
  const employees = await Employee.find({ isDeleted: false, status: 'active' }).select(
    'name email employeeId department designation role salary joiningDate profileImage',
  );

  // --- Pre-aggregate the signals we need, in bulk (avoids N+1 queries) -------

  // Department median salary, used as the "market rate" reference.
  const salaryByDept = {};
  for (const e of employees) {
    if (!e.department) continue;
    (salaryByDept[e.department] ||= []).push(e.salary || 0);
  }
  const deptMedian = Object.fromEntries(
    Object.entries(salaryByDept).map(([dept, salaries]) => [dept, median(salaries)]),
  );

  // Approved leave days per employee, split into paid-allowance vs unpaid.
  const leaveAgg = await LeaveRequest.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: { employee: '$employee', type: '$type' }, days: { $sum: '$days' } } },
  ]);
  const paidLeaveUsed = {}; // employeeId -> days against a capped allowance
  const unpaidLeaveUsed = {};
  for (const row of leaveAgg) {
    const id = row._id.employee.toString();
    if (row._id.type === 'unpaid') unpaidLeaveUsed[id] = (unpaidLeaveUsed[id] || 0) + row.days;
    else paidLeaveUsed[id] = (paidLeaveUsed[id] || 0) + row.days;
  }
  const totalPaidAllowance = Object.values(LEAVE_ALLOWANCE).reduce((a, b) => a + b, 0);

  // Count of open/in-progress tickets each employee raised.
  const ticketAgg = await Ticket.aggregate([
    { $match: { status: { $in: ['open', 'in_progress'] } } },
    { $group: { _id: '$raisedBy', count: { $sum: 1 } } },
  ]);
  const openTickets = Object.fromEntries(ticketAgg.map((t) => [t._id.toString(), t.count]));

  // --- Score each employee ---------------------------------------------------
  const now = Date.now();
  const results = employees.map((e) => {
    const id = e._id.toString();
    const factors = [];

    // 1) Pay below department median.
    const marketRate = deptMedian[e.department] || 0;
    if (marketRate > 0 && e.salary < marketRate) {
      const shortfall = (marketRate - e.salary) / marketRate; // 0..1
      const points = Math.round(Math.min(1, shortfall / 0.25) * WEIGHTS.belowMarketPay);
      if (points > 0) {
        factors.push({ label: `Paid ${Math.round(shortfall * 100)}% below the ${e.department} median`, points });
      }
    }

    // 2) High paid-leave utilisation.
    const paidUsed = paidLeaveUsed[id] || 0;
    if (paidUsed > 0) {
      const ratio = paidUsed / totalPaidAllowance; // 0..1+
      const points = Math.round(Math.min(1, ratio) * WEIGHTS.highLeaveUsage);
      if (points >= 4) factors.push({ label: `Used ${paidUsed} of ${totalPaidAllowance} leave days`, points });
    }

    // 3) Unpaid leave taken.
    if ((unpaidLeaveUsed[id] || 0) > 0) {
      factors.push({ label: `Took ${unpaidLeaveUsed[id]} day(s) of unpaid leave`, points: WEIGHTS.unpaidLeave });
    }

    // 4) Open helpdesk tickets.
    const tickets = openTickets[id] || 0;
    if (tickets > 0) {
      const points = Math.min(tickets * 5, WEIGHTS.openTickets);
      factors.push({ label: `${tickets} unresolved helpdesk ticket(s)`, points });
    }

    // 5) Tenure stagnation (long service is a promotion-gap proxy here).
    const tenureYears = e.joiningDate ? (now - new Date(e.joiningDate).getTime()) / (365 * DAY) : 0;
    if (tenureYears >= 3) {
      const points = Math.round(Math.min(1, (tenureYears - 3) / 4) * WEIGHTS.tenureStagnation);
      if (points > 0) factors.push({ label: `${tenureYears.toFixed(1)} years in the same role`, points });
    }

    const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
    return { employee: e, score, band: band(score), factors };
  });

  return results.sort((a, b) => b.score - a.score);
}
