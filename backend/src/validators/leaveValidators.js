/** express-validator rules for the leave endpoints. */
import { body } from 'express-validator';
import { LEAVE_TYPES, HALF_DAY_SLOTS } from '../models/LeaveRequest.js';

/** Shared date-range rules used by both preview and create. */
const rangeRules = [
  body('startDate').isISO8601().withMessage('A valid start date is required'),
  body('endDate').isISO8601().withMessage('A valid end date is required'),
  body('halfDay')
    .optional({ values: 'null' })
    .isIn(HALF_DAY_SLOTS)
    .withMessage(`halfDay must be one of: ${HALF_DAY_SLOTS.join(', ')}`),
];

/** POST /api/leave/preview */
export const previewLeaveRules = [...rangeRules];

/** POST /api/leave */
export const createLeaveRules = [
  body('type').isIn(LEAVE_TYPES).withMessage(`Type must be one of: ${LEAVE_TYPES.join(', ')}`),
  ...rangeRules,
  body('reason')
    .optional({ values: 'falsy' })
    .isLength({ max: 500 })
    .withMessage('Reason is too long'),
];

/** PATCH /api/leave/:id/decision */
export const decideLeaveRules = [
  body('decision')
    .isIn(['approved', 'rejected'])
    .withMessage("Decision must be 'approved' or 'rejected'"),
  body('reviewNote')
    .optional({ values: 'falsy' })
    .isLength({ max: 500 })
    .withMessage('Note is too long'),
];

/** POST /api/holidays */
export const createHolidayRules = [
  body('date').isISO8601().withMessage('A valid date is required'),
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('A holiday name is required'),
  body('region').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
];
