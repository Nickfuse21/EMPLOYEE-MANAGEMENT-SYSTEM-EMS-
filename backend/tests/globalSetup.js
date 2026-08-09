/**
 * Vitest global setup — runs once for the whole test run, before any file.
 *
 * Boots a single in-memory MongoDB replica set and publishes its URI through an
 * environment variable. Every test process connects to that one server but uses
 * its own database (see tests/setup.js), so files stay isolated without paying
 * the mongod start-up cost per file.
 *
 * A *replica set* (rather than a standalone server) is required because the
 * application uses multi-document transactions.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet;

export async function setup() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_TEST_URI = replSet.getUri();
}

export async function teardown() {
  await replSet?.stop();
}
