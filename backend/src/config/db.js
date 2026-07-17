/**
 * MongoDB connection helper.
 *
 * Establishes a single shared Mongoose connection and logs the outcome. The
 * server refuses to start if the database is unreachable, so failures surface
 * immediately instead of on the first request.
 */
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Some ISP/OS DNS resolvers refuse the SRV/TXT lookups that "mongodb+srv://"
// (MongoDB Atlas) requires, producing "querySrv ECONNREFUSED". Pointing Node's
// resolver at public DNS servers (Google + Cloudflare) makes those lookups work
// without changing any system settings.
dns.setServers(['8.8.8.8', '1.1.1.1']);

export async function connectDatabase() {
  // Fail fast on malformed queries instead of silently ignoring bad fields.
  mongoose.set('strictQuery', true);

  const connection = await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 15000, // Give Atlas a moment to be selected.
  });
  console.log(`✅ MongoDB connected: ${connection.connection.host}/${connection.connection.name}`);
  return connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
