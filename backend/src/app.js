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
import morgan from 'morgan';

import { env, isProduction } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // --- Global middleware ---------------------------------------------------
  app.use(
    cors({
      origin: env.clientOrigin, // Only the known frontend may call the API.
      credentials: true, // Allow the auth cookie to be sent cross-origin.
    }),
  );
  app.use(express.json({ limit: '5mb' })); // Parse JSON bodies (avatars can be base64).
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!isProduction) app.use(morgan('dev')); // Request logging in development.

  // --- Health check --------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });

  // --- Feature routes ------------------------------------------------------
  app.use('/api', apiRouter);

  // --- Error handling (must be last) ---------------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
