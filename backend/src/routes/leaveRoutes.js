/**
 * Leave-management routes: /api/leave/*
 *
 * Applying for leave and viewing your own balance is open to every authenticated
 * user; approving/rejecting is restricted to HR & Super Admin.
 */
import { Router } from 'express';
import {
  getMyBalance,
  listLeave,
  createLeave,
  decideLeave,
  cancelLeave,
} from '../controllers/leaveController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createLeaveRules, decideLeaveRules } from '../validators/leaveValidators.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

router.use(authenticate);

router.get('/balance', getMyBalance);
router.get('/', listLeave);
router.post('/', createLeaveRules, validate, createLeave);
router.patch('/:id/cancel', cancelLeave);

// Approving/rejecting is a management action.
router.patch(
  '/:id/decision',
  authorize(ROLES.SUPER_ADMIN, ROLES.HR_MANAGER),
  decideLeaveRules,
  validate,
  decideLeave,
);

export default router;
