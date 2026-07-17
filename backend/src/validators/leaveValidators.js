/** express-validator rules for the leave endpoints. */
import { body } from 'express-validator';
import { LEAVE_TYPES } from '../models/LeaveRequest.js';

/** POST /api/leave */
export const createLeaveRules = [
  body('type').isIn(LEAVE_TYPES).withMessage(`Type must be one of: ${LEAVE_TYPES.join(', ')}`),
  body('startDate').isISO8601().withMessage('A valid start date is required'),
  body('endDate').isISO8601().withMessage('A valid end date is required'),
  body('reason').optional({ values: 'falsy' }).isLength({ max: 500 }).withMessage('Reason is too long'),
];

/** PATCH /api/leave/:id/decision */
export const decideLeaveRules = [
  body('decision').isIn(['approved', 'rejected']).withMessage("Decision must be 'approved' or 'rejected'"),
  body('reviewNote').optional({ values: 'falsy' }).isLength({ max: 500 }).withMessage('Note is too long'),
];
