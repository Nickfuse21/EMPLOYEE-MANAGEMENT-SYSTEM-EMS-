import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // One in-memory MongoDB per process, shared by every file in that process.
    // Tests within a file run sequentially, and each file gets a clean database
    // via the global `beforeEach` in tests/setup.js.
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],
    // Mongoose models are global singletons, so parallel files in one process
    // would fight over the same connection. Give each file its own process.
    pool: 'forks',
    testTimeout: 20000,
    hookTimeout: 60000, // First run downloads the mongod binary.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/seed.js', 'src/server.js'],
    },
  },
});
