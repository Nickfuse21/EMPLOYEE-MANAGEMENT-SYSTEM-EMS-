/**
 * Dashboard controller.
 *
 * Produces the summary metrics required by the assignment (total / active /
 * inactive employees and department count) plus grouped breakdowns and a
 * "recent hires" list that power the dashboard charts and widgets.
 *
 * Sensitive payroll figures (total payroll, average salary) are included ONLY
 * for a Super Admin — HR and Employees never receive them.
 */
import { Employee } from '../models/Employee.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ROLES } from '../utils/roles.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const baseFilter = { isDeleted: false };

  // Run the independent aggregations in parallel for speed.
  const [total, active, inactive, departments, byDepartment, byRole, recentHires] = await Promise.all([
    Employee.countDocuments(baseFilter),
    Employee.countDocuments({ ...baseFilter, status: 'active' }),
    Employee.countDocuments({ ...baseFilter, status: 'inactive' }),
    Employee.distinct('department', { ...baseFilter, department: { $nin: [null, ''] } }),
    // Head-count grouped by department (for a bar chart).
    Employee.aggregate([
      { $match: { ...baseFilter, department: { $nin: [null, ''] } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, department: '$_id', count: 1 } },
    ]),
    // Head-count grouped by role (for the donut).
    Employee.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $project: { _id: 0, role: '$_id', count: 1 } },
    ]),
    // Five most recently-joined employees (for the "Recent Hires" widget).
    Employee.find(baseFilter)
      .sort({ joiningDate: -1 })
      .limit(5)
      .select('name employeeId department designation joiningDate profileImage role status'),
  ]);

  const data = {
    totalEmployees: total,
    activeEmployees: active,
    inactiveEmployees: inactive,
    departmentCount: departments.length,
    byDepartment,
    byRole,
    recentHires,
  };

  // --- Super-Admin-only payroll insights -----------------------------------
  if (req.user.role === ROLES.SUPER_ADMIN) {
    const [payroll] = await Employee.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalPayroll: { $sum: '$salary' },
          avgSalary: { $avg: '$salary' },
        },
      },
    ]);
    data.totalPayroll = payroll?.totalPayroll ?? 0;
    data.avgSalary = Math.round(payroll?.avgSalary ?? 0);
  }

  res.json({ success: true, data });
});
