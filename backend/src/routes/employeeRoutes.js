/**
 * Employee & hierarchy routes: /api/employees/*
 *
 * Every route requires authentication. Role guards (`authorize`) declare the
 * coarse permission at the route level; finer, data-dependent rules live in the
 * controllers.
 */
import { Router } from 'express';
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '../controllers/employeeController.js';
import { getReportees, assignManager } from '../controllers/organizationController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createEmployeeRules,
  updateEmployeeRules,
  assignManagerRules,
} from '../validators/employeeValidators.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

// All employee routes require a logged-in user.
router.use(authenticate);

// List: Super Admin + HR only.
router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.HR_MANAGER), listEmployees);

// Create: Super Admin + HR only.
router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.HR_MANAGER),
  createEmployeeRules,
  validate,
  createEmployee,
);

// Direct reports of an employee (Super Admin + HR).
router.get('/:id/reportees', authorize(ROLES.SUPER_ADMIN, ROLES.HR_MANAGER), getReportees);

// Assign / clear reporting manager (Super Admin + HR).
router.patch(
  '/:id/manager',
  authorize(ROLES.SUPER_ADMIN, ROLES.HR_MANAGER),
  assignManagerRules,
  validate,
  assignManager,
);

// Read one: any authenticated user (controller restricts Employees to self).
router.get('/:id', getEmployee);

// Update: any authenticated user (controller enforces role-specific field rules).
router.put('/:id', updateEmployeeRules, validate, updateEmployee);

// Delete (soft): Super Admin only.
router.delete('/:id', authorize(ROLES.SUPER_ADMIN), deleteEmployee);

export default router;
