/**
 * Server entry point.
 *
 * Connects to MongoDB first, then starts the HTTP server. Also wires up
 * graceful-shutdown handlers so the process closes cleanly on Ctrl+C / SIGTERM.
 */
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import {
  env,
  getProductionConfigurationError,
  getProductionConfigurationWarnings,
} from './config/env.js';

async function start() {
  try {
    // Fail before opening a port rather than after: a server that is listening
    // with a forgeable JWT secret is worse than one that never started.
    const configurationError = getProductionConfigurationError();
    if (configurationError) throw new Error(configurationError);
    for (const warning of getProductionConfigurationWarnings()) {
      console.warn(`⚠️  ${warning}`);
    }

    await connectDatabase();

    const app = createApp();
    const server = app.listen(env.port, () => {
      console.log(`🚀 EMS API running at http://localhost:${env.port} (${env.nodeEnv})`);
    });

    // Graceful shutdown: stop accepting requests, then close the DB connection.
    const shutdown = async (signal) => {
      console.log(`\n${signal} received — shutting down gracefully...`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
