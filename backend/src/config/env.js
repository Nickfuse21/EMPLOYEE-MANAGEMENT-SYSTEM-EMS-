/**
 * Centralised environment configuration.
 *
 * Loads variables from `.env` once and exposes a single, typed `env` object so
 * the rest of the codebase never reads `process.env` directly. This keeps
 * configuration in one place and makes missing values easy to spot.
 */
import dotenv from 'dotenv';

dotenv.config();

const isVercel = process.env.VERCEL === '1';
const nodeEnv = process.env.NODE_ENV || (isVercel ? 'production' : 'development');
const isProductionEnvironment = nodeEnv === 'production';
const developmentMongoUri = 'mongodb://127.0.0.1:27017/ems';
const developmentJwtSecret = 'insecure_dev_secret_change_me';

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv,
  mongoUri: process.env.MONGO_URI || (isProductionEnvironment ? '' : developmentMongoUri),
  jwtSecret: process.env.JWT_SECRET || (isProductionEnvironment ? '' : developmentJwtSecret),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@ems.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
};

export const isProduction = isProductionEnvironment;

/**
 * Returns a safe, actionable configuration error for serverless deployments.
 * It deliberately names variables only; secrets and connection strings are
 * never sent to the client or written to logs.
 */
export function getProductionConfigurationError() {
  if (!isProduction) return null;

  const missing = [];
  if (!env.mongoUri) missing.push('MONGO_URI');
  if (!env.jwtSecret) missing.push('JWT_SECRET');

  return missing.length
    ? `Missing required production environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`
    : null;
}
