/**
 * Configuration-guard tests.
 *
 * These check the rules that decide whether a production deployment is allowed
 * to serve traffic at all. They re-import config/env.js with a modified
 * environment, since that module reads process.env once at import time.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Imports a fresh copy of config/env.js under the given environment.
 * `resetModules` clears the module cache so the module's import-time read of
 * process.env happens again with the overrides in place.
 */
async function loadEnv(overrides) {
  vi.resetModules();
  const saved = { ...process.env };
  Object.assign(process.env, overrides);
  try {
    return await import('../src/config/env.js');
  } finally {
    process.env = saved;
  }
}

afterEach(() => {
  vi.resetModules();
});

describe('getProductionConfigurationError', () => {
  it('passes with a proper production configuration', async () => {
    const { getProductionConfigurationError } = await loadEnv({
      NODE_ENV: 'production',
      MONGO_URI: 'mongodb://db/ems',
      JWT_SECRET: 'a'.repeat(48),
    });

    expect(getProductionConfigurationError()).toBeNull();
  });

  it('rejects a missing JWT secret', async () => {
    const { getProductionConfigurationError } = await loadEnv({
      NODE_ENV: 'production',
      MONGO_URI: 'mongodb://db/ems',
      JWT_SECRET: '',
    });

    expect(getProductionConfigurationError()).toMatch(/JWT_SECRET is not set/);
  });

  it('rejects a JWT secret that is too short to resist brute force', async () => {
    const { getProductionConfigurationError, MIN_JWT_SECRET_LENGTH } = await loadEnv({
      NODE_ENV: 'production',
      MONGO_URI: 'mongodb://db/ems',
      JWT_SECRET: 'short',
    });

    expect(getProductionConfigurationError()).toMatch(
      new RegExp(`at least ${MIN_JWT_SECRET_LENGTH}`),
    );
  });

  it('rejects a missing database URI', async () => {
    const { getProductionConfigurationError } = await loadEnv({
      NODE_ENV: 'production',
      MONGO_URI: '',
      JWT_SECRET: 'a'.repeat(48),
    });

    expect(getProductionConfigurationError()).toMatch(/MONGO_URI/);
  });

  it('stays silent outside production', async () => {
    const { getProductionConfigurationError } = await loadEnv({
      NODE_ENV: 'development',
      MONGO_URI: '',
      JWT_SECRET: '',
    });

    expect(getProductionConfigurationError()).toBeNull();
  });

  it('does not take the API down over a default seed password', async () => {
    // The seed password only affects `npm run seed`, so it is a warning rather
    // than a reason to refuse every request.
    const { getProductionConfigurationError, getProductionConfigurationWarnings } = await loadEnv({
      NODE_ENV: 'production',
      MONGO_URI: 'mongodb://db/ems',
      JWT_SECRET: 'a'.repeat(48),
      SEED_ADMIN_PASSWORD: 'Admin@123',
    });

    expect(getProductionConfigurationError()).toBeNull();
    expect(getProductionConfigurationWarnings()).toContainEqual(
      expect.stringMatching(/SEED_ADMIN_PASSWORD/),
    );
  });
});

describe('CLIENT_ORIGIN parsing', () => {
  it('accepts several comma-separated origins', async () => {
    const { env } = await loadEnv({
      CLIENT_ORIGIN: 'https://ems.example.com, https://preview.vercel.app',
    });

    expect(env.clientOrigins).toEqual(['https://ems.example.com', 'https://preview.vercel.app']);
  });

  it('strips a trailing slash, which would otherwise never match', async () => {
    const { env } = await loadEnv({ CLIENT_ORIGIN: 'https://ems.example.com/' });

    expect(env.clientOrigins).toEqual(['https://ems.example.com']);
  });

  it('falls back to the local dev origins when unset', async () => {
    const { env } = await loadEnv({ CLIENT_ORIGIN: '', CLIENT_ORIGINS: '' });

    expect(env.clientOrigins).toContain('http://localhost:5173');
  });
});
