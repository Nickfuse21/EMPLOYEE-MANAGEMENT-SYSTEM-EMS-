/**
 * Employee controller — full CRUD plus search / filter / sort / pagination.
 *
 * RBAC is enforced here in addition to the route-level guards, because some
 * rules depend on the *data* (e.g. "an Employee may only edit their own
 * profile", "HR may not grant the Super Admin role").
 */
import { Employee } from '../models/Employee.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ROLES } from '../utils/roles.js';
import { assertNoCircularReporting } from '../services/organizationService.js';
import { recordAudit, diffSensitiveChanges } from '../services/auditService.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';
import { containsMatcher } from '../utils/sanitize.js';

/** Fields an Employee (non-admin) is allowed to change on their own profile. */
const SELF_EDITABLE_FIELDS = ['name', 'phone', 'profileImage'];

/** Populate config reused across responses to show manager summary info. */
const MANAGER_POPULATE = { path: 'reportingManager', select: 'name email employeeId designation' };

/**
 * Guard: HR Managers may neither create nor promote anyone to Super Admin.
 * Only a Super Admin can mint another Super Admin.
 */
function ensureCanAssignRole(actor, targetRole) {
  if (targetRole === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only a Super Admin can assign the Super Admin role');
  }
}

/**
 * GET /api/employees
 * Supports: ?search= &department= &role= &status= &sortBy= &order= &page= &limit=
 * Accessible to Super Admin and HR Manager (see route guard).
 */
export const listEmployees = asyncHandler(async (req, res) => {
  const {
    search = '',
    department,
    role,
    status,
    sortBy = 'createdAt',
    order = 'desc',
    page = 1,
    limit = 10,
  } = req.query;

  // Base filter always excludes soft-deleted records.
  const filter = { isDeleted: false };

  // Search by name OR email (case-insensitive). The term is escaped before it
  // reaches `$regex` — see utils/sanitize.js for why that matters.
  if (search) {
    const matcher = containsMatcher(search);
    filter.$or = [{ name: matcher }, { email: matcher }];
  }
  if (department) filter.department = department;
  if (role) filter.role = role;
  if (status) filter.status = status;

  // Whitelist sortable fields to avoid arbitrary/injection sorting.
  const allowedSort = ['name', 'joiningDate', 'createdAt', 'salary'];
  const sortField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
  const sortDir = order === 'asc' ? 1 : -1;

  // Pagination (bonus feature).
  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * pageSize;

  const [items, total] = await Promise.all([
    Employee.find(filter)
      .populate(MANAGER_POPULATE)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(pageSize),
    Employee.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  });
});

/**
 * GET /api/employees/:id
 * Employees may only fetch their own record; admins/HR may fetch anyone.
 */
export const getEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role === ROLES.EMPLOYEE && req.user._id.toString() !== id) {
    throw ApiError.forbidden('You can only view your own profile');
  }

  const employee = await Employee.findOne({ _id: id, isDeleted: false }).populate(MANAGER_POPULATE);
  if (!employee) throw ApiError.notFound('Employee not found');

  res.json({ success: true, data: employee });
});

/**
 * POST /api/employees
 * Create a new employee. Super Admin & HR only (route guard). HR cannot create
 * a Super Admin (enforced here).
 */
export const createEmployee = asyncHandler(async (req, res) => {
  const payload = req.body;

  if (payload.role) ensureCanAssignRole(req.user, payload.role);

  // Validate the reporting manager exists before saving.
  if (payload.reportingManager) {
    const managerExists = await Employee.exists({
      _id: payload.reportingManager,
      isDeleted: false,
    });
    if (!managerExists) throw ApiError.badRequest('Reporting manager not found');
  }

  const employee = await Employee.create(payload);
  const populated = await employee.populate(MANAGER_POPULATE);

  await recordAudit({
    action: AUDIT_ACTIONS.EMPLOYEE_CREATED,
    actor: req.user,
    target: employee,
    summary: `Created employee ${employee.name} (${employee.role})`,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    message: 'Employee created successfully',
    data: populated,
  });
});

/**
 * PUT /api/employees/:id
 * Update an employee. Behaviour depends on the caller's role:
 *  - Employee: may edit ONLY their own limited fields.
 *  - HR Manager: may edit anyone but cannot grant the Super Admin role.
 *  - Super Admin: may edit anything.
 */
export const updateEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isSelf = req.user._id.toString() === id;
  const updates = { ...req.body };

  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');

  // --- Role-specific rules -------------------------------------------------
  if (req.user.role === ROLES.EMPLOYEE) {
    if (!isSelf) throw ApiError.forbidden('You can only edit your own profile');
    // Strip everything except the whitelisted self-editable fields.
    for (const key of Object.keys(updates)) {
      if (!SELF_EDITABLE_FIELDS.includes(key)) delete updates[key];
    }
  } else if (req.user.role === ROLES.HR_MANAGER) {
    // HR cannot elevate anyone to Super Admin.
    if (updates.role) ensureCanAssignRole(req.user, updates.role);
    // HR cannot modify a Super Admin account.
    if (employee.role === ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('HR cannot modify a Super Admin account');
    }
  }

  // Validate a changed reporting manager (existence + no cycle).
  if (updates.reportingManager !== undefined && updates.reportingManager) {
    const managerExists = await Employee.exists({
      _id: updates.reportingManager,
      isDeleted: false,
    });
    if (!managerExists) throw ApiError.badRequest('Reporting manager not found');
    await assertNoCircularReporting(id, updates.reportingManager);
  }

  // Snapshot the sensitive fields *before* mutating, so we can log what changed.
  const sensitiveChanges = diffSensitiveChanges(
    { salary: employee.salary, role: employee.role },
    updates,
  );

  // Apply updates and save (so pre-save hooks like password hashing still run).
  Object.assign(employee, updates);
  await employee.save();
  const populated = await employee.populate(MANAGER_POPULATE);

  // Log a generic "updated" event plus a dedicated event for each sensitive
  // change (salary / role) so those stand out in the audit trail.
  await recordAudit({
    action: AUDIT_ACTIONS.EMPLOYEE_UPDATED,
    actor: req.user,
    target: employee,
    summary: `Updated ${employee.name}`,
    metadata: { fields: Object.keys(updates) },
    ip: req.ip,
  });
  for (const change of sensitiveChanges) {
    await recordAudit({ ...change, actor: req.user, target: employee, ip: req.ip });
  }

  res.json({
    success: true,
    message: 'Employee updated successfully',
    data: populated,
  });
});

/**
 * DELETE /api/employees/:id
 * Soft delete (bonus): sets `isDeleted`, keeping the record for audit/history.
 * Super Admin only (route guard). Any direct reports are detached so they don't
 * point at a deleted manager.
 */
export const deleteEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user._id.toString() === id) {
    throw ApiError.badRequest('You cannot delete your own account');
  }

  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw ApiError.notFound('Employee not found');

  employee.isDeleted = true;
  employee.status = 'inactive';
  await employee.save();

  // Re-parent orphaned reports to the deleted employee's own manager.
  await Employee.updateMany(
    { reportingManager: id, isDeleted: false },
    { reportingManager: employee.reportingManager },
  );

  await recordAudit({
    action: AUDIT_ACTIONS.EMPLOYEE_DELETED,
    actor: req.user,
    target: employee,
    summary: `Soft-deleted employee ${employee.name}`,
    ip: req.ip,
  });

  res.json({ success: true, message: 'Employee deleted successfully' });
});
