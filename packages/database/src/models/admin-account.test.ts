import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AdminAccountModel,
  hashPassword,
  verifyPassword,
  SCRYPT_PARAMS_V1,
  CURRENT_HASH_VERSION,
} from './admin-account.js';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Use raw collection to avoid model registration conflicts in parallel/sequential runs
  await mongoose.connection.db!.collection('admin_accounts').deleteMany({});
});

describe('AdminAccount model', () => {
  it('creates an admin account with required fields', async () => {
    const hashResult = await hashPassword('testpassword123');
    const account = await AdminAccountModel.create({
      email: 'admin@example.com',
      role: 'ADMIN',
      passwordHash: hashResult.passwordHash,
      passwordSalt: hashResult.passwordSalt,
      scryptParams: hashResult.scryptParams,
      hashVersion: hashResult.hashVersion,
    });

    expect(account.email).toBe('admin@example.com');
    expect(account.role).toBe('ADMIN');
    expect(account.disabled).toBe(false);
    expect(account.hashVersion).toBe(CURRENT_HASH_VERSION);
    expect(account.createdAt).toBeInstanceOf(Date);
    expect(account.updatedAt).toBeInstanceOf(Date);
  });

  it('normalizes email to lowercase', async () => {
    const hashResult = await hashPassword('testpassword123');
    const account = await AdminAccountModel.create({
      email: 'Admin@Example.COM',
      role: 'ADMIN',
      passwordHash: hashResult.passwordHash,
      passwordSalt: hashResult.passwordSalt,
      scryptParams: hashResult.scryptParams,
      hashVersion: hashResult.hashVersion,
    });

    expect(account.email).toBe('admin@example.com');
  });

  it('enforces unique email constraint', async () => {
    const hashResult = await hashPassword('testpassword123');
    await AdminAccountModel.create({
      email: 'admin@example.com',
      role: 'ADMIN',
      passwordHash: hashResult.passwordHash,
      passwordSalt: hashResult.passwordSalt,
      scryptParams: hashResult.scryptParams,
      hashVersion: hashResult.hashVersion,
    });

    await expect(
      AdminAccountModel.create({
        email: 'admin@example.com',
        role: 'ADMIN',
        passwordHash: hashResult.passwordHash,
        passwordSalt: hashResult.passwordSalt,
        scryptParams: hashResult.scryptParams,
        hashVersion: hashResult.hashVersion,
      }),
    ).rejects.toThrow();
  });
});

describe('Password hashing', () => {
  it('hashes a password and produces consistent results with same salt', async () => {
    const result1 = await hashPassword('mypassword');
    const result2 = await hashPassword('mypassword');

    // Different random salts → different hashes
    expect(result1.passwordHash).not.toBe(result2.passwordHash);
    expect(result1.passwordSalt).not.toBe(result2.passwordSalt);

    // Same params
    expect(result1.scryptParams).toEqual(SCRYPT_PARAMS_V1);
    expect(result1.hashVersion).toBe(CURRENT_HASH_VERSION);
  });

  it('verifies correct password', async () => {
    const password = 'mysecretpassword';
    const hashResult = await hashPassword(password);

    const valid = await verifyPassword(
      password,
      hashResult.passwordHash,
      hashResult.passwordSalt,
      hashResult.scryptParams,
    );

    expect(valid).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hashResult = await hashPassword('correctpassword');

    const valid = await verifyPassword(
      'wrongpassword',
      hashResult.passwordHash,
      hashResult.passwordSalt,
      hashResult.scryptParams,
    );

    expect(valid).toBe(false);
  });

  it('produces hex-encoded hash and salt of expected lengths', async () => {
    const hashResult = await hashPassword('test');

    // salt is 32 bytes = 64 hex chars
    expect(hashResult.passwordSalt).toMatch(/^[0-9a-f]{64}$/);
    // key is 64 bytes = 128 hex chars
    expect(hashResult.passwordHash).toMatch(/^[0-9a-f]{128}$/);
  });
});
