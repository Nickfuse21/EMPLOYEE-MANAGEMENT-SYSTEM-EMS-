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

/* ------------------------------------------------------------------ */
/* Extended feature types                                              */
/* ------------------------------------------------------------------ */

/** A single audit-trail entry (Super Admin). */
export interface AuditLog {
  _id: string;
  action: string;
  actorName: string;
  actorRole: string;
  targetName?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export type LeaveType = 'annual' | 'sick' | 'casual' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  _id: string;
  employee: Employee;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  reviewedBy?: { _id: string; name: string } | null;
  reviewNote?: string;
  reviewedAt?: string | null;
  createdAt: string;
}

/** One paid-leave type's balance. */
export interface LeaveBalance {
  type: LeaveType;
  allowance: number;
  used: number;
  remaining: number;
}

export type TicketCategory = 'it' | 'hr' | 'payroll' | 'facilities' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface TicketComment {
  _id?: string;
  author: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface Ticket {
  _id: string;
  ticketId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  raisedBy: Employee;
  assignedTo?: { _id: string; name: string; employeeId: string; profileImage?: string } | null;
  comments: TicketComment[];
  createdAt: string;
}

/** A single scored employee in the attrition report. */
export interface AttritionRisk {
  employee: Employee;
  score: number;
  band: 'low' | 'medium' | 'high';
  factors: { label: string; points: number }[];
}

export interface AttritionReport {
  summary: { high: number; medium: number; low: number };
  employees: AttritionRisk[];
}

/** A handbook document summary (list view). */
export interface PolicySummary {
  _id: string;
  title: string;
  category: string;
  updatedAt: string;
}

/** A cited passage returned by the policy assistant. */
export interface PolicyCitation {
  id: string;
  title: string;
  category: string;
  passage: string;
}

export interface PolicyAnswer {
  answer: string | null;
  message?: string;
  matchedTerms?: string[];
  citations: PolicyCitation[];
}
