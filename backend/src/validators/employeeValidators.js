/**
 * express-validator rule sets for the auth and employee endpoints.
 *
 * Keeping validation declarative and colocated makes the API's input contract
 * obvious and satisfies the assignment's "frontend & backend validation"
 * requirement on the server side.
 */
import { body } from 'express-validator';
import { ROLE_VALUES } from '../utils/roles.js';

/**
 * Minimum password strength, applied anywhere a password is set.
 *
 * A 6-character minimum with no other requirement admits "123456" and
 * "password", which are the first guesses any attacker makes. The upper bound
 * exists because bcrypt silently truncates at 72 bytes — rejecting longer input
 * is clearer than accepting it and ignoring the tail.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

/** The most common passwords, rejected outright regardless of shape. */
const BANNED_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'admin@123', 'admin123',
  'qwerty123', '1234567890', 'letmein123', 'welcome123', 'iloveyou1', 'changeme1',
]);

/**
 * Builds the strength rules for a password field.
 * @param {string} field  Body field name.
 * @param {object} [opts]
 * @param {boolean} [opts.optional] Skip when the field is absent/empty.
 */
export function passwordRules(field, { optional = false } = {}) {
  let chain = body(field);
  if (optional) chain = chain.optional({ values: 'falsy' });

  return [
    chain
      .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
      .withMessage(
        `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
      )
      .bail()
      .matches(/[a-z]/)
      .withMessage('Password must contain a lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter')
      .matches(/\d/)
      .withMessage('Password must contain a number')
      .matches(/[^A-Za-z0-9]/)
      .withMessage('Password must contain a symbol')
      .custom((value) => !BANNED_PASSWORDS.has(String(value).toLowerCase()))
      .withMessage('That password is too common — please choose another'),
  ];
}

/** POST /api/auth/login */
export const loginRules = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  // Deliberately only "not empty": rejecting a weak password at *login* would
  // tell an attacker which stored passwords are weak.
  body('password').notEmpty().withMessage('Password is required'),
];

/** POST /api/auth/change-password */
export const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Your current password is required'),
  ...passwordRules('newPassword'),
];

/** POST /api/employees — all business fields validated. */
export const createEmployeeRules = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  ...passwordRules('password'),
  body('profileImage')
    .optional({ values: 'falsy' })
    .isLength({ max: 1_500_000 })
    .withMessage('Profile image is too large (max ~1 MB)'),
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
  ...passwordRules('password', { optional: true }),
  body('profileImage')
    .optional({ values: 'falsy' })
    .isLength({ max: 1_500_000 })
    .withMessage('Profile image is too large (max ~1 MB)'),
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
