/**
 * Holiday-calendar routes: /api/holidays/*
 *
 * Readable by every authenticated user (the leave form needs it); writable only
 * by HR and Super Admin.
 */
import { Router } from 'express';
import {
  listHolidays,
  createHoliday,
  deleteHoliday,
} from '../controllers/holidayController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createHolidayRules } from '../validators/leaveValidators.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

router.use(authenticate);

router.get('/', listHolidays);
router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.HR_MANAGER),
  createHolidayRules,
  validate,
  createHoliday,
);
router.delete('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.HR_MANAGER), deleteHoliday);

export default router;
