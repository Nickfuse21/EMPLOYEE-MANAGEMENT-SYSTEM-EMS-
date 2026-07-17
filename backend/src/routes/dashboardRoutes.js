/**
 * Dashboard routes: /api/dashboard/*
 */
import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

// Aggregate stats are for Super Admin & HR (management view).
router.get(
  '/stats',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.HR_MANAGER),
  getDashboardStats,
);

export default router;
