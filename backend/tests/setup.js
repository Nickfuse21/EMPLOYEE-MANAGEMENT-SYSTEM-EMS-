/**
 * Per-process test setup — runs once in every test worker.
 *
 * Connects Mongoose to the in-memory server started by globalSetup, giving each
 * worker its own database so files running in parallel can never see each
 * other's documents. Every collection is emptied before each test, so tests
 * start from a known-empty state and can run in any order.
 */
import { afterAll, beforeAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';

// Deterministic, test-only configuration. Set before any src/ module is
// imported so config/env.js picks these up instead of the developer's .env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_not_used_anywhere_real';
process.env.JWT_EXPIRES_IN = '1h';

// Registers every schema on the shared mongoose instance so their indexes can
// be built below. Imported after the env vars above are set.
await import('../src/models/registry.js');

beforeAll(async () => {
  const uri = process.env.MONGO_TEST_URI;
  if (!uri) throw new Error('MONGO_TEST_URI is not set — did globalSetup run?');

  // One database per worker: ems_test_<worker id>.
  const dbName = `ems_test_${process.env.VITEST_POOL_ID || '0'}`;
  await mongoose.connect(uri, { dbName });

  // Build the schemas' indexes up front. Without this, unique constraints are
  // not enforced yet when the first test runs and duplicate-key tests flake.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});

beforeEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
