/**
 * Policy-assistant routes: /api/policies/*
 *
 * Open to every authenticated user — but each handler scopes results to the
 * documents the caller's role is allowed to see (see policyController).
 */
import { Router } from 'express';
import { body } from 'express-validator';
import { listPolicies, getPolicy, askPolicy } from '../controllers/policyController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.get('/', listPolicies);
router.post(
  '/ask',
  [body('question').trim().notEmpty().withMessage('A question is required')],
  validate,
  askPolicy,
);
router.get('/:id', getPolicy);

export default router;
