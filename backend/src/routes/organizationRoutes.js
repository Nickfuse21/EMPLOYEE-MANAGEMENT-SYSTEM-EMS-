/**
 * Organisation routes: /api/organization/*
 */
import { Router } from 'express';
import { getOrganizationTree, getMyTeam } from '../controllers/organizationController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// The org chart is visible to any authenticated user.
router.get('/tree', authenticate, getOrganizationTree);

// Personalised "my team" view for any authenticated user.
router.get('/my-team', authenticate, getMyTeam);

export default router;
