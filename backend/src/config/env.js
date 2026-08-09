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

/** Shortest JWT secret we will accept in production (bytes of entropy-ish). */
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Parses the comma-separated CLIENT_ORIGIN(S) value into a list.
 * Supporting several origins matters in practice: local dev, preview
 * deployments, and production are all different hosts.
 */
function parseOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, '')) // Trailing slash breaks CORS matching.
    .filter(Boolean);
}

const configuredOrigins = parseOrigins(process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS);

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv,
  mongoUri: process.env.MONGO_URI || (isProductionEnvironment ? '' : developmentMongoUri),
  jwtSecret: process.env.JWT_SECRET || (isProductionEnvironment ? '' : developmentJwtSecret),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  clientOrigins: configuredOrigins.length
    ? configuredOrigins
    : ['http://localhost:5173', 'http://localhost:8080'],
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@ems.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
};

export const isProduction = isProductionEnvironment;

/** The seed password published in the README and .env.example. */
export const DOCUMENTED_SEED_PASSWORD = 'Admin@123';

/**
 * Returns a safe, actionable configuration error for serverless deployments, or
 * null when the deployment is fit to serve traffic.
 *
 * Only values the *running API* cannot work safely without are fatal here.
 * Something like a default seed password is a real problem, but it is a problem
 * with the seed script rather than with serving requests — refusing every
 * request over it would take a working deployment down for no security gain.
 * Those are reported by `getProductionConfigurationWarnings` instead.
 *
 * The message deliberately names variables only; secrets and connection strings
 * are never sent to the client or written to logs.
 */
export function getProductionConfigurationError() {
  if (!isProduction) return null;

  const problems = [];
  if (!env.mongoUri) problems.push('MONGO_URI is not set');

  if (!env.jwtSecret) {
    problems.push('JWT_SECRET is not set');
  } else if (env.jwtSecret === developmentJwtSecret) {
    problems.push('JWT_SECRET is still the development placeholder');
  } else if (env.jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    // A short secret is brute-forceable, and a forged token is indistinguishable
    // from a real one — worth failing loudly for rather than starting up
    // "successfully" with every session forgeable.
    problems.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
  }

  return problems.length ? `Invalid production configuration: ${problems.join('; ')}` : null;
}

/**
 * Non-fatal production misconfigurations, logged on start-up so they are visible
 * without taking the deployment offline.
 */
export function getProductionConfigurationWarnings() {
  if (!isProduction) return [];

  const warnings = [];
  if (env.seedAdminPassword === DOCUMENTED_SEED_PASSWORD) {
    warnings.push(
      'SEED_ADMIN_PASSWORD is still the documented default — change it and rotate the admin password',
    );
  }
  if (env.clientOrigins.some((o) => o.startsWith('http://') && !o.includes('localhost'))) {
    warnings.push('A non-localhost CLIENT_ORIGIN is using plain http:// rather than https://');
  }
  return warnings;
}
