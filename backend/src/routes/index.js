/**
 * Root API router — mounts every feature router under its base path.
 */
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import employeeRoutes from './employeeRoutes.js';
import organizationRoutes from './organizationRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import auditRoutes from './auditRoutes.js';
import leaveRoutes from './leaveRoutes.js';
import ticketRoutes from './ticketRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import policyRoutes from './policyRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/organization', organizationRoutes);
router.use('/dashboard', dashboardRoutes);

// Extended feature modules.
router.use('/audit', auditRoutes); // Super-Admin audit trail.
router.use('/leave', leaveRoutes); // Leave requests + balances.
router.use('/tickets', ticketRoutes); // Helpdesk.
router.use('/analytics', analyticsRoutes); // Attrition / flight-risk.
router.use('/policies', policyRoutes); // Policy assistant.

export default router;
