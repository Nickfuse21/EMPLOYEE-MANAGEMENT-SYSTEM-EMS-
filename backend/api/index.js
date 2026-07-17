/**
 * Vercel serverless entry point.
 *
 * The local Docker/Node entry point (`src/server.js`) owns `app.listen()`.
 * Vercel invokes this handler instead, so an HTTP listener must never be
 * started here. The database connection promise is cached per warm instance.
 */
import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/config/db.js';
import { getProductionConfigurationError } from '../src/config/env.js';

const app = createApp();
let databaseConnection;

function ensureDatabaseConnection() {
  if (!databaseConnection) {
    databaseConnection = connectDatabase().catch((error) => {
      // Allow a later invocation to retry after a transient database failure.
      databaseConnection = undefined;
      throw error;
    });
  }

  return databaseConnection;
}

export default async function handler(req, res) {
  const configurationError = getProductionConfigurationError();
  if (configurationError) {
    console.error(`Backend configuration error: ${configurationError}`);
    return res.status(503).json({
      success: false,
      message: 'Backend deployment is missing required environment variables',
    });
  }

  try {
    await ensureDatabaseConnection();
    return app(req, res);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable',
    });
  }
}
