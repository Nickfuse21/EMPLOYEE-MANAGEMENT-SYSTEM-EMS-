/** express-validator rules for the helpdesk ticket endpoints. */
import { body } from 'express-validator';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../models/Ticket.js';

/** POST /api/tickets */
export const createTicketRules = [
  body('subject').trim().isLength({ min: 3, max: 140 }).withMessage('Subject must be 3–140 characters'),
  body('description').trim().isLength({ min: 1, max: 4000 }).withMessage('A description is required'),
  body('category').optional().isIn(TICKET_CATEGORIES).withMessage('Invalid category'),
  body('priority').optional().isIn(TICKET_PRIORITIES).withMessage('Invalid priority'),
];

/** PATCH /api/tickets/:id */
export const updateTicketRules = [
  body('status').optional().isIn(TICKET_STATUSES).withMessage('Invalid status'),
  body('priority').optional().isIn(TICKET_PRIORITIES).withMessage('Invalid priority'),
  body('category').optional().isIn(TICKET_CATEGORIES).withMessage('Invalid category'),
  body('assignedTo')
    .optional({ values: 'null' })
    .custom((v) => v === null || /^[a-f\d]{24}$/i.test(v))
    .withMessage('Assignee must be a valid employee id or null'),
];

/** POST /api/tickets/:id/comments */
export const commentRules = [
  body('body').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment cannot be empty'),
];
