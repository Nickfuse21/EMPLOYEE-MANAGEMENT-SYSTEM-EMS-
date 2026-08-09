/**
 * Leave-management controller.
 *
 * Employees apply for leave and see their own balance. A request is routed to
 * the employee's reporting manager first and falls back to HR when they have no
 * manager — which is how approvals actually work in an organisation, and the
 * reason the reporting hierarchy is worth storing at all.
 *
 * The rules enforced on submission are the ones that keep the data honest:
 * only working days are charged, the dates must not overlap an existing
 * request, and the employee must have the entitlement to cover it.
 */
import { Employee } from '../models/Employee.js';
import { LeaveRequest, HALF_DAY_SLOTS, countCalendarDays } from '../models/LeaveRequest.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ROLES } from '../utils/roles.js';
import { recordAudit } from '../services/auditService.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { countWorkingDays, listNonWorkingDays } from '../services/leaveCalendarService.js';
import {
  computeBalance,
  assertNoOverlap,
  assertSufficientBalance,
} from '../services/leaveBalanceService.js';

const EMPLOYEE_POPULATE = {
  path: 'employee',
  select: 'name email employeeId department designation profileImage reportingManager',
};
const REVIEWER_POPULATE = { path: 'reviewedBy', select: 'name employeeId' };
const PENDING_WITH_POPULATE = { path: 'pendingWith', select: 'name employeeId designation' };
const ALL_POPULATES = [EMPLOYEE_POPULATE, REVIEWER_POPULATE, PENDING_WITH_POPULATE];

/** HR and Super Admin can see and act on everyone's leave. */
function isHr(user) {
  return user.role === ROLES.SUPER_ADMIN || user.role === ROLES.HR_MANAGER;
}

/**
 * Decides who a request should sit with.
 *
 * The employee's own manager owns the first decision; if they have no manager
 * (the CEO, or a record where the line is not filled in) it goes straight to HR,
 * represented by a null `pendingWith`.
 */
async function resolveApprover(employeeId) {
  const employee = await Employee.findById(employeeId).select('reportingManager').lean();
  return employee?.reportingManager ?? null;
}

/**
 * True when `user` is allowed to decide `request`.
 *
 * HR can always step in — someone has to be able to unblock a request when a
 * manager is on leave themselves — but the manager it is assigned to is the
 * normal path.
 */
function canDecide(user, request) {
  if (isHr(user)) return true;
  return request.pendingWith?.toString() === user._id.toString();
}

/**
 * GET /api/leave/balance
 * The logged-in user's own leave balance for the current leave year.
 */
export const getMyBalance = asyncHandler(async (req, res) => {
  const balance = await computeBalance(req.user._id);
  res.json({ success: true, data: balance });
});

/**
 * POST /api/leave/preview
 * Prices a date range without submitting it, so the UI can show "3 working days
 * (2 weekend days excluded)" before the employee commits.
 */
export const previewLeave = asyncHandler(async (req, res) => {
  const { startDate, endDate, halfDay = null } = req.body;
  assertValidRange(startDate, endDate);

  const { days, breakdown } = await countWorkingDays(startDate, endDate);
  const excluded = await listNonWorkingDays(startDate, endDate);

  res.json({
    success: true,
    data: {
      workingDays: applyHalfDay(days, halfDay, startDate, endDate),
      calendarDays: breakdown.total,
      excluded,
    },
  });
});

/**
 * GET /api/leave
 * Employees see only their own requests. Managers additionally see the requests
 * assigned to them; HR sees everything. Optional ?status= filter, newest first.
 */
export const listLeave = asyncHandler(async (req, res) => {
  const { status, scope } = req.query;
  const filter = {};

  if (isHr(req.user)) {
    // HR sees everything by default; ?scope=mine narrows to their own requests.
    if (scope === 'mine') filter.employee = req.user._id;
  } else if (scope === 'inbox') {
    // A manager's approval queue — only what still needs a decision.
    filter.pendingWith = req.user._id;
    filter.status = 'pending';
  } else {
    // Own requests, plus anything awaiting this user's decision.
    filter.$or = [{ employee: req.user._id }, { pendingWith: req.user._id }];
  }
  if (status) filter.status = status;

  const requests = await LeaveRequest.find(filter)
    .populate(ALL_POPULATES)
    .sort({ createdAt: -1 });

  res.json({ success: true, data: requests });
});

/**
 * POST /api/leave
 * Apply for leave (any authenticated user, always on their own behalf).
 */
export const createLeave = asyncHandler(async (req, res) => {
  const { type, startDate, endDate, reason = '', halfDay = null } = req.body;

  assertValidRange(startDate, endDate);
  if (halfDay && !HALF_DAY_SLOTS.includes(halfDay)) {
    throw ApiError.badRequest(`halfDay must be one of: ${HALF_DAY_SLOTS.join(', ')}`);
  }

  const { days: workingDays, breakdown } = await countWorkingDays(startDate, endDate);
  if (workingDays === 0) {
    throw ApiError.badRequest(
      'That range contains no working days — it falls entirely on weekends or public holidays',
    );
  }

  const days = applyHalfDay(workingDays, halfDay, startDate, endDate);

  // Order matters: reject a clash before spending balance checks on it.
  await assertNoOverlap(req.user._id, startDate, endDate);
  await assertSufficientBalance(req.user._id, type, days, startDate);

  const request = await LeaveRequest.create({
    employee: req.user._id,
    type,
    startDate,
    endDate,
    days,
    calendarDays: breakdown.total,
    halfDay,
    reason,
    pendingWith: await resolveApprover(req.user._id),
  });

  const populated = await request.populate(ALL_POPULATES);

  await recordAudit({
    action: AUDIT_ACTIONS.LEAVE_REQUESTED,
    actor: req.user,
    target: req.user,
    summary: `${req.user.name} requested ${days} day(s) of ${type} leave`,
    metadata: { leaveId: request.id, type, days, startDate, endDate },
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    message: 'Leave request submitted',
    data: populated,
  });
});

/**
 * PATCH /api/leave/:id/decision
 * Approve or reject a request — the assigned manager, or HR.
 */
export const decideLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { decision, reviewNote = '' } = req.body; // 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(decision)) {
    throw ApiError.badRequest("Decision must be 'approved' or 'rejected'");
  }

  const request = await LeaveRequest.findById(id);
  if (!request) throw ApiError.notFound('Leave request not found');

  if (request.employee.toString() === req.user._id.toString()) {
    // Self-approval would make the whole approval step meaningless, and it is
    // reachable whenever a manager or HR user requests leave themselves.
    throw ApiError.forbidden('You cannot decide your own leave request');
  }
  if (!canDecide(req.user, request)) {
    throw ApiError.forbidden('This request is not awaiting your approval');
  }
  if (request.status !== 'pending') {
    throw ApiError.badRequest(`This request has already been ${request.status}`);
  }

  // Re-check the balance at decision time: other requests may have been approved
  // since this one was submitted.
  if (decision === 'approved') {
    await assertSufficientBalance(request.employee, request.type, request.days, request.startDate);
  }

  request.status = decision;
  request.reviewedBy = req.user._id;
  request.reviewNote = reviewNote;
  request.reviewedAt = new Date();
  // `pendingWith` is deliberately left in place: it records who the request was
  // routed to, which is worth keeping after the fact. `status` is what marks it
  // as done — the approval queue filters on that.
  await request.save();

  const employee = await Employee.findById(request.employee).select('name');
  await recordAudit({
    action: AUDIT_ACTIONS.LEAVE_DECISION,
    actor: req.user,
    target: employee,
    summary: `${decision === 'approved' ? 'Approved' : 'Rejected'} ${request.days}-day ${request.type} leave for ${employee?.name}`,
    metadata: { leaveId: request.id, type: request.type, days: request.days, decision },
    ip: req.ip,
  });

  const populated = await request.populate(ALL_POPULATES);
  res.json({ success: true, message: `Leave ${decision}`, data: populated });
});

/**
 * PATCH /api/leave/:id/cancel
 * An employee cancels their own request. Pending requests can always be pulled;
 * an already-approved one can be cancelled while it is still in the future,
 * which returns the days to their balance.
 */
export const cancelLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await LeaveRequest.findById(id);
  if (!request) throw ApiError.notFound('Leave request not found');

  const isOwner = request.employee.toString() === req.user._id.toString();
  if (!isOwner && !isHr(req.user)) {
    throw ApiError.forbidden('You can only cancel your own leave request');
  }

  if (!['pending', 'approved'].includes(request.status)) {
    throw ApiError.badRequest(`A ${request.status} request cannot be cancelled`);
  }
  if (request.status === 'approved' && request.startDate <= new Date() && !isHr(req.user)) {
    throw ApiError.badRequest(
      'Approved leave that has already started can only be cancelled by HR',
    );
  }

  request.status = 'cancelled';
  request.pendingWith = null;
  await request.save();

  res.json({ success: true, message: 'Leave request cancelled', data: request });
});

// --- helpers ---------------------------------------------------------------

/** Rejects ranges that are backwards or unparseable. */
function assertValidRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest('Start and end dates must be valid dates');
  }
  if (end < start) {
    throw ApiError.badRequest('End date cannot be before the start date');
  }
}

/**
 * Applies a half-day slot. Half days only make sense on a single-day request —
 * "the afternoon of a four-day absence" is not a thing.
 */
function applyHalfDay(days, halfDay, startDate, endDate) {
  if (!halfDay) return days;

  const sameDay = new Date(startDate).toDateString() === new Date(endDate).toDateString();
  if (!sameDay) {
    throw ApiError.badRequest('A half day can only be requested for a single date');
  }
  return days === 0 ? 0 : 0.5;
}
