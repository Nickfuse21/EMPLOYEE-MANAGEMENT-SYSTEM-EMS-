/**
 * Leave-management controller.
 *
 * Employees apply for leave and see their own balance; HR & Super Admin review
 * (approve / reject) everyone's requests. Balance is *derived* from approved
 * requests rather than stored, so it is always correct by construction.
 */
import { Employee } from '../models/Employee.js';
import {
  LeaveRequest,
  LEAVE_ALLOWANCE,
  countLeaveDays,
} from '../models/LeaveRequest.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ROLES } from '../utils/roles.js';
import { recordAudit } from '../services/auditService.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';

const EMPLOYEE_POPULATE = { path: 'employee', select: 'name email employeeId department designation profileImage' };
const REVIEWER_POPULATE = { path: 'reviewedBy', select: 'name employeeId' };

/** Managers (HR + Super Admin) may see and act on everyone's leave. */
function isManager(user) {
  return user.role === ROLES.SUPER_ADMIN || user.role === ROLES.HR_MANAGER;
}

/**
 * Computes remaining balance per paid leave type for one employee, by summing
 * the days from their APPROVED requests and subtracting from the allowance.
 */
async function computeBalance(employeeId) {
  const approved = await LeaveRequest.aggregate([
    { $match: { employee: employeeId, status: 'approved' } },
    { $group: { _id: '$type', used: { $sum: '$days' } } },
  ]);
  const usedByType = Object.fromEntries(approved.map((r) => [r._id, r.used]));

  return Object.entries(LEAVE_ALLOWANCE).map(([type, allowance]) => {
    const used = usedByType[type] || 0;
    return { type, allowance, used, remaining: Math.max(0, allowance - used) };
  });
}

/**
 * GET /api/leave/balance
 * The logged-in user's own leave balance (any role).
 */
export const getMyBalance = asyncHandler(async (req, res) => {
  const balance = await computeBalance(req.user._id);
  res.json({ success: true, data: balance });
});

/**
 * GET /api/leave
 * Employees see only their own requests; managers see all (optionally filtered
 * by ?status=). Newest first.
 */
export const listLeave = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (!isManager(req.user)) filter.employee = req.user._id;
  if (status) filter.status = status;

  const requests = await LeaveRequest.find(filter)
    .populate(EMPLOYEE_POPULATE)
    .populate(REVIEWER_POPULATE)
    .sort({ createdAt: -1 });

  res.json({ success: true, data: requests });
});

/**
 * POST /api/leave
 * Apply for leave (any authenticated user, always on their own behalf).
 */
export const createLeave = asyncHandler(async (req, res) => {
  const { type, startDate, endDate, reason = '' } = req.body;

  if (new Date(endDate) < new Date(startDate)) {
    throw ApiError.badRequest('End date cannot be before the start date');
  }

  const days = countLeaveDays(startDate, endDate);

  const request = await LeaveRequest.create({
    employee: req.user._id,
    type,
    startDate,
    endDate,
    days,
    reason,
  });
  const populated = await request.populate(EMPLOYEE_POPULATE);

  res.status(201).json({
    success: true,
    message: 'Leave request submitted',
    data: populated,
  });
});

/**
 * PATCH /api/leave/:id/decision
 * Approve or reject a request. HR & Super Admin only (route guard).
 */
export const decideLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { decision, reviewNote = '' } = req.body; // decision: 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(decision)) {
    throw ApiError.badRequest("Decision must be 'approved' or 'rejected'");
  }

  const request = await LeaveRequest.findById(id);
  if (!request) throw ApiError.notFound('Leave request not found');
  if (request.status !== 'pending') {
    throw ApiError.badRequest(`This request has already been ${request.status}`);
  }

  request.status = decision;
  request.reviewedBy = req.user._id;
  request.reviewNote = reviewNote;
  request.reviewedAt = new Date();
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

  const populated = await request.populate([EMPLOYEE_POPULATE, REVIEWER_POPULATE]);
  res.json({ success: true, message: `Leave ${decision}`, data: populated });
});

/**
 * PATCH /api/leave/:id/cancel
 * An employee cancels their own still-pending request.
 */
export const cancelLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await LeaveRequest.findById(id);
  if (!request) throw ApiError.notFound('Leave request not found');

  const isOwner = request.employee.toString() === req.user._id.toString();
  if (!isOwner && !isManager(req.user)) {
    throw ApiError.forbidden('You can only cancel your own leave request');
  }
  if (request.status !== 'pending') {
    throw ApiError.badRequest('Only pending requests can be cancelled');
  }

  request.status = 'cancelled';
  await request.save();

  res.json({ success: true, message: 'Leave request cancelled', data: request });
});
