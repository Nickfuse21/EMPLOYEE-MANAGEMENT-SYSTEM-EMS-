/**
 * Shared TypeScript types mirroring the backend's data shapes. Having these in
 * one place gives the whole app end-to-end type safety.
 */

export type Role = 'super_admin' | 'hr_manager' | 'employee';
export type Status = 'active' | 'inactive';

/** A manager summary as returned by populated queries. */
export interface ManagerRef {
  _id: string;
  name: string;
  email: string;
  employeeId: string;
  designation?: string;
}

/** The core employee/user entity. */
export interface Employee {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  designation?: string;
  salary?: number;
  joiningDate?: string;
  status: Status;
  role: Role;
  reportingManager?: ManagerRef | string | null;
  profileImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** A node in the organisation tree (employee + nested reports). */
export interface OrgNode extends Employee {
  directReports: OrgNode[];
}

/** Aggregated dashboard metrics. */
export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  departmentCount: number;
  byDepartment: { department: string; count: number }[];
  byRole: { role: Role; count: number }[];
  recentHires: Employee[];
  // Super-Admin only (undefined for other roles).
  totalPayroll?: number;
  avgSalary?: number;
}

/** Personalised team view for the logged-in user. */
export interface MyTeam {
  manager: Employee | null;
  peers: Employee[];
  directReports: Employee[];
}

/** Pagination metadata returned by the employee list endpoint. */
export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Query parameters for listing employees. */
export interface EmployeeQuery {
  search?: string;
  department?: string;
  role?: Role | '';
  status?: Status | '';
  sortBy?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
