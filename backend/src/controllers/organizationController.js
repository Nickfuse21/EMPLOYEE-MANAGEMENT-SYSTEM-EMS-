/**
 * Organisational-hierarchy controller.
 *
 * Exposes the company reporting tree, an employee's direct reports, and a
 * dedicated endpoint to (re)assign an employee's reporting manager with
 * circular-relationship protection.
 */
import { Employee } from '../models/Employee.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  buildOrganizationTree,
  assertNoCircularReporting,
} from '../services/organizationService.js';

/** Fields returned for people shown in "my team" lists. */
const TEAM_SELECT = 'name email employeeId designation department role status profileImage';

/**
 * GET /api/organization/tree
 * Returns the full nested reporting hierarchy.
 */
export const getOrganizationTree = asyncHandler(async (_req, res) => {
  const tree = await buildOrganizationTree();
  res.json({ success: true, data: tree });
});

/**
 * GET /api/organization/my-team
 * Personalised team view for the logged-in user (any role):
 *   • their reporting manager,
 *   • their peers (colleagues sharing the same manager), and
 *   • their own direct reports.
 *
 * This gives plain Employees a meaningful, self-service view of their place in
 * the organisation without exposing the company-wide directory.
 */
export const getMyTeam = asyncHandler(async (req, res) => {
  const meId = req.user._id;

  const me = await Employee.findById(meId).populate('reportingManager', TEAM_SELECT);
  const manager = me.reportingManager || null;
  const managerId = manager?._id;

  // Peers share the same manager (excluding the user themselves).
  const peers = managerId
    ? await Employee.find({ reportingManager: managerId, _id: { $ne: meId }, isDeleted: false })
        .select(TEAM_SELECT)
        .sort({ name: 1 })
    : [];

  // People who report directly to the user.
  const directReports = await Employee.find({ reportingManager: meId, isDeleted: false })
    .select(TEAM_SELECT)
    .sort({ name: 1 });

  res.json({
    success: true,
    data: { manager, peers, directReports },
  });
});

/**
 * GET /api/employees/:id/reportees
 * Returns the direct reports of a given employee.
 */
export const getReportees = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const manager = await Employee.findOne({ _id: id, isDeleted: false }).select('name employeeId');
  if (!manager) throw ApiError.notFound('Employee not found');

  const reportees = await Employee.find({ reportingManager: id, isDeleted: false })
    .select('name email employeeId designation department status role profileImage')
    .sort({ name: 1 });

  res.json({
    success: true,
    manager,
    count: reportees.length,
    data: reportees,
  });
});

/**
 * PATCH /api/employees/:id/manager
 * Assigns (or clears, when null) an employee's reporting manager.
 * Super Admin & HR only (route guard).
 */
export const assignManager = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reportingManager } = req.body; // May be a valid id or null.

  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');

  if (reportingManager) {
    const managerExists = await Employee.exists({ _id: reportingManager, isDeleted: false });
    if (!managerExists) throw ApiError.badRequest('Reporting manager not found');
    await assertNoCircularReporting(id, reportingManager);
  }

  employee.reportingManager = reportingManager || null;
  await employee.save();
  const populated = await employee.populate('reportingManager', 'name email employeeId designation');

  res.json({
    success: true,
    message: reportingManager ? 'Reporting manager assigned' : 'Reporting manager cleared',
    data: populated,
  });
});
