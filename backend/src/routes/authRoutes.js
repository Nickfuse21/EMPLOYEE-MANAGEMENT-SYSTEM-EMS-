/**
 * Authentication routes: /api/auth/*
 */
import { Router } from 'express';
import { login, logout, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { loginRules } from '../validators/employeeValidators.js';

const router = Router();

router.post('/login', loginRules, validate, login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

export default router;
