import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | undefined;

export async function connectInMemoryDatabase(): Promise<void> {
  if (!mongod) {
    mongod = await MongoMemoryServer.create();
  }
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

export async function disconnectInMemoryDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = undefined;
  }
}

export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    if (collection) {
      await collection.deleteMany({});
    }
  }
}
