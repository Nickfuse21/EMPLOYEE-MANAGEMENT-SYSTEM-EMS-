/**
 * MongoDB connection helper.
 *
 * Works in two very different runtimes:
 *   • Local Node/Docker — one long-lived process, one connection.
 *   • Vercel serverless — many short-lived invocations; connections must be
 *     reused across "warm" instances and must fail fast, because the platform
 *     kills a function that runs longer than its timeout (Hobby plan ≈ 10 s).
 */
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env, isProduction } from './env.js';

// Some local ISP/OS resolvers refuse the SRV/TXT lookups that "mongodb+srv://"
// (MongoDB Atlas) needs, producing "querySrv ECONNREFUSED". Pointing Node's
// resolver at public DNS fixes that WITHOUT changing system settings.
//
// IMPORTANT: only do this locally. On Vercel/Lambda the platform resolver
// already handles the SRV lookup, and forcing outbound DNS to 8.8.8.8 / 1.1.1.1
// there can make the lookup hang until the function is force-killed → a bare
// 500. So we skip the override in production.
if (!isProduction) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

// Mongoose buffers queries while disconnected; in serverless that just delays
// the real error until the platform timeout. Fail fast instead, and reject
// unknown query fields.
mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

export async function connectDatabase() {
  // Reuse a live connection across warm serverless invocations rather than
  // opening a new one on every request. readyState 1 === connected.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const connection = await mongoose.connect(env.mongoUri, {
    // Keep this BELOW the platform's function timeout so a bad connection
    // surfaces a real error our handler can turn into a clean 503, instead of
    // being force-killed into an opaque 500.
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 20000,
    // Serverless instances are many and short-lived — keep each pool small.
    maxPoolSize: 5,
  });

  console.log(`✅ MongoDB connected: ${connection.connection.host}/${connection.connection.name}`);
  return connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
