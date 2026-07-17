/**
 * Centralised environment configuration.
 *
 * Loads variables from `.env` once and exposes a single, typed `env` object so
 * the rest of the codebase never reads `process.env` directly. This keeps
 * configuration in one place and makes missing values easy to spot.
 */
import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ems',
  jwtSecret: process.env.JWT_SECRET || 'insecure_dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@ems.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
};

export const isProduction = env.nodeEnv === 'production';
