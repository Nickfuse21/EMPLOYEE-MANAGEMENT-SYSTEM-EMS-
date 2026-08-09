/**
 * Leave-management routes: /api/leave/*
 *
 * Applying for leave and viewing your own balance is open to every authenticated
 * user. Approving is NOT guarded by role here: a request is decided by the
 * employee's own reporting manager — who is usually a plain Employee — or by HR.
 * That rule depends on the request's data, so it lives in the controller
 * (`canDecide`) rather than in a coarse role check.
 */
import { Router } from 'express';
import {
  getMyBalance,
  listLeave,
  previewLeave,
  createLeave,
  decideLeave,
  cancelLeave,
} from '../controllers/leaveController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import {
  createLeaveRules,
  decideLeaveRules,
  previewLeaveRules,
} from '../validators/leaveValidators.js';

const router = Router();

router.use(authenticate);

router.get('/balance', getMyBalance);
router.get('/', listLeave);
router.post('/preview', previewLeaveRules, validate, previewLeave);
router.post('/', createLeaveRules, validate, createLeave);
router.patch('/:id/cancel', cancelLeave);
router.patch('/:id/decision', decideLeaveRules, validate, decideLeave);

export default router;
