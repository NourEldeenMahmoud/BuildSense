import mongoose from 'mongoose';

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
