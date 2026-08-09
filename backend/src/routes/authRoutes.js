/**
 * Authentication routes: /api/auth/*
 */
import { Router } from 'express';
import {
  login,
  logout,
  logoutEverywhere,
  changePassword,
  getMe,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { loginRules, changePasswordRules } from '../validators/employeeValidators.js';

const router = Router();

// The limiter runs before validation so malformed floods are cheap to reject.
router.post('/login', loginLimiter, loginRules, validate, login);
router.post('/logout', logout);
router.post('/logout-all', authenticate, logoutEverywhere);
router.post(
  '/change-password',
  authenticate,
  loginLimiter,
  changePasswordRules,
  validate,
  changePassword,
);
router.get('/me', authenticate, getMe);

export default router;
