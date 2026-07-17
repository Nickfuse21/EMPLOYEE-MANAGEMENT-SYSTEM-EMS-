/**
 * Audit-log routes: /api/audit/*
 *
 * The audit trail is a Super-Admin-only security feature, so the whole router
 * is guarded to that single role.
 */
import { Router } from 'express';
import { listAuditLogs } from '../controllers/auditController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

router.get('/', listAuditLogs);

export default router;
