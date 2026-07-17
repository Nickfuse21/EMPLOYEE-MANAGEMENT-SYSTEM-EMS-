/**
 * express-validator rule sets for the auth and employee endpoints.
 *
 * Keeping validation declarative and colocated makes the API's input contract
 * obvious and satisfies the assignment's "frontend & backend validation"
 * requirement on the server side.
 */
import { body } from 'express-validator';
import { ROLE_VALUES } from '../utils/roles.js';

/** POST /api/auth/login */
export const loginRules = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

/** POST /api/employees — all business fields validated. */
export const createEmployeeRules = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('phone')
    .optional({ values: 'falsy' })
    .matches(/^[0-9+\-\s()]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
  body('salary')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 })
    .withMessage('Salary must be a positive number'),
  body('role').optional().isIn(ROLE_VALUES).withMessage('Invalid role'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  body('joiningDate').optional().isISO8601().withMessage('Joining date must be a valid date'),
  body('reportingManager')
    .optional({ values: 'null' })
    .isMongoId()
    .withMessage('Reporting manager must be a valid employee id'),
];

/**
 * PUT /api/employees/:id — same rules but every field is optional (partial
 * update) and password may be omitted to keep the existing one.
 */
export const updateEmployeeRules = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password')
    .optional({ values: 'falsy' })
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('phone')
    .optional({ values: 'falsy' })
    .matches(/^[0-9+\-\s()]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
  body('salary').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
  body('role').optional().isIn(ROLE_VALUES).withMessage('Invalid role'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  body('joiningDate').optional().isISO8601().withMessage('Joining date must be a valid date'),
];

/** PATCH /api/employees/:id/manager */
export const assignManagerRules = [
  body('reportingManager')
    .optional({ values: 'null' })
    .custom((value) => value === null || /^[a-f\d]{24}$/i.test(value))
    .withMessage('Reporting manager must be a valid employee id or null'),
];
