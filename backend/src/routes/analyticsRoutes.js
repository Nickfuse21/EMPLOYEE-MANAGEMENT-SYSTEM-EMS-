/**
 * Analytics routes: /api/analytics/*
 *
 * These insights expose sensitive per-person signals, so the whole router is
 * limited to HR & Super Admin.
 */
import { Router } from 'express';
import { getAttritionReport } from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.HR_MANAGER));

router.get('/attrition', getAttritionReport);

export default router;
