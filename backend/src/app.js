/**
 * Express application factory.
 *
 * Wires together middleware, routes, and error handling. Kept separate from
 * `server.js` (which owns the DB connection + listening) so the app can be
 * imported into tests without starting a real server.
 */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, isProduction } from './config/env.js';
import apiRouter from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // --- Global middleware ---------------------------------------------------

  // Behind exactly one reverse proxy (nginx / Vercel), so `req.ip` is taken from
  // the last entry of X-Forwarded-For. Deliberately NOT `true`: trusting every
  // hop would let a client forge the header and evade the rate limiters.
  app.set('trust proxy', 1);

  // Security headers: CSP, HSTS, X-Content-Type-Options, frame denial, etc.
  // `crossOriginResourcePolicy` is relaxed to same-site because the API is
  // served from a different origin than the SPA in the hosted deployment.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(
    cors({
      origin: env.clientOrigins, // Only known frontends may call the API.
      credentials: true, // Allow the auth cookie to be sent cross-origin.
    }),
  );
  // 2 MB is enough for any JSON payload the API accepts, including a base64
  // avatar (which the employee validator caps separately). The previous 5 MB
  // ceiling let a single request tie up a lot of memory for no benefit.
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  if (!isProduction && env.nodeEnv !== 'test') app.use(morgan('dev'));

  // --- Health check --------------------------------------------------------
  // Deliberately mounted before the rate limiter so uptime probes are never
  // throttled.
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });

  // --- Feature routes ------------------------------------------------------
  app.use('/api', apiLimiter, apiRouter);

  // --- Error handling (must be last) ---------------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
