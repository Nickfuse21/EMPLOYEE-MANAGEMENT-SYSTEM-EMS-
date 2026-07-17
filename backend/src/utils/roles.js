/**
 * Single source of truth for the three roles defined in the assignment.
 * Importing these constants everywhere avoids typos in magic strings.
 */
export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  HR_MANAGER: 'hr_manager',
  EMPLOYEE: 'employee',
});

export const ROLE_VALUES = Object.values(ROLES);

/** Human-readable labels for UI display. */
export const ROLE_LABELS = Object.freeze({
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.HR_MANAGER]: 'HR Manager',
  [ROLES.EMPLOYEE]: 'Employee',
});
