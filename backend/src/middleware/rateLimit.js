/**
 * Rate limiters.
 *
 * The API records failed logins as a security signal, but recording alone does
 * not stop an attacker — without a limit, credential stuffing runs at whatever
 * rate the network allows. These limiters put a ceiling on it.
 *
 * Two layers, because they defend different things:
 *   • `loginLimiter`  — narrow and strict, protects credentials.
 *   • `apiLimiter`    — wide and loose, protects the service from a single
 *                       noisy or runaway client.
 *
 * Limits are disabled under NODE_ENV=test so suites can make many requests;
 * rateLimit.test.js re-enables them explicitly to verify the behaviour.
 */
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Limits are off under NODE_ENV=test so suites can make many requests freely.
 * Setting ENABLE_RATE_LIMIT=1 turns them back on, which is how rateLimit.test.js
 * exercises the real behaviour. Read per-request rather than at import time so a
 * test can flip it after the middleware is built.
 */
function shouldSkip() {
  return env.nodeEnv === 'test' && process.env.ENABLE_RATE_LIMIT !== '1';
}

/** Shared JSON error shape, matching the global error handler's output. */
function limitResponse(message) {
  return (_req, res) => res.status(429).json({ success: false, message });
}

/**
 * Login attempts: 5 per 15 minutes per IP.
 *
 * `skipSuccessfulRequests` means a legitimate user who logs in correctly never
 * consumes budget — only failures count, so the limit bites attackers rather
 * than a shared office IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: shouldSkip,
  handler: limitResponse('Too many login attempts. Please try again in 15 minutes'),
});

/** General API traffic: 300 requests per 15 minutes per IP. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: shouldSkip,
  handler: limitResponse('Too many requests. Please slow down and try again shortly'),
});
