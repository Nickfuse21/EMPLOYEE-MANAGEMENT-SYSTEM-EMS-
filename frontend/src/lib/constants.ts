/** UI-facing constants: role labels/options and status options. */
import type { Role, Status } from '../types';

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  hr_manager: 'HR Manager',
  employee: 'Employee',
};

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'super_admin', label: 'Super Admin' },
];

export const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/** Colour palette reused by the dashboard charts. */
export const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

/* --- Extended feature options / labels ------------------------------ */

export const LEAVE_TYPE_OPTIONS = [
  { value: 'annual', label: 'Annual' },
  { value: 'sick', label: 'Sick' },
  { value: 'casual', label: 'Casual' },
  { value: 'unpaid', label: 'Unpaid' },
] as const;

export const TICKET_CATEGORY_OPTIONS = [
  { value: 'it', label: 'IT' },
  { value: 'hr', label: 'HR' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'facilities', label: 'Facilities' },
  { value: 'other', label: 'Other' },
] as const;

export const TICKET_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export const TICKET_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
] as const;

/** Badge tone per leave/ticket status, so colour is consistent everywhere. */
export const STATUS_TONE: Record<string, 'green' | 'red' | 'amber' | 'slate' | 'indigo'> = {
  approved: 'green',
  resolved: 'green',
  closed: 'slate',
  rejected: 'red',
  cancelled: 'slate',
  pending: 'amber',
  open: 'amber',
  in_progress: 'indigo',
};

export const PRIORITY_TONE: Record<string, 'green' | 'red' | 'amber' | 'slate'> = {
  low: 'slate',
  medium: 'amber',
  high: 'red',
  urgent: 'red',
};
