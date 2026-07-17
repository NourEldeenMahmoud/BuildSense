import mongoose, { type ClientSession } from 'mongoose';

let connectionPromise: Promise<void> | undefined;

export async function connectDatabase(uri: string, dbName: string): Promise<void> {
  if (isDatabaseConnected()) {
    return;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri, { dbName })
      .then(() => undefined)
      .finally(() => {
        connectionPromise = undefined;
      });
  }

  await connectionPromise;
}

export async function disconnectDatabase(): Promise<void> {
  if (connectionPromise) {
    await connectionPromise;
  }

  if (!isDatabaseConnected()) {
    return;
  }

  await mongoose.disconnect();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Start a Mongoose ClientSession.  Returns null when the connected server does
 * not support sessions (e.g. a standalone MongoMemoryServer in tests).  Callers
 * must pass the session (or undefined) into every model operation that should
 * participate in the transaction.
 */
export async function startSession(): Promise<ClientSession | null> {
  if (!isDatabaseConnected()) {
    return null;
  }
  try {
    return await mongoose.startSession();
  } catch {
    return null;
  }
}
