/**
 * Helpdesk ticket routes: /api/tickets/*
 *
 * Raising, viewing (own), and commenting are open to every authenticated user.
 * Triage (assign / change status / priority) is restricted to HR & Super Admin.
 */
import { Router } from 'express';
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  addComment,
} from '../controllers/ticketController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createTicketRules,
  updateTicketRules,
  commentRules,
} from '../validators/ticketValidators.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

router.use(authenticate);

router.get('/', listTickets);
router.post('/', createTicketRules, validate, createTicket);
router.get('/:id', getTicket);
router.post('/:id/comments', commentRules, validate, addComment);

// Triage is a management action.
router.patch(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.HR_MANAGER),
  updateTicketRules,
  validate,
  updateTicket,
);

export default router;
