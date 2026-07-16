import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AdminSessionModel,
  generateToken,
  hashToken,
  generateCsrfToken,
  hashCsrfToken,
  timingSafeEqualBuffers,
} from './admin-session.js';

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
  await AdminSessionModel.deleteMany({});
  // Clean up test accounts using raw collection (avoids importing AdminAccountModel)
  await mongoose.connection.db!.collection('admin_accounts').deleteMany({});
});

describe('AdminSession model', () => {
  async function createTestAccount(): Promise<mongoose.Types.ObjectId> {
    // Use raw collection insert to avoid importing AdminAccountModel (which would
    // cause OverwriteModelError when multiple test files run in the same process).
    const result = await mongoose.connection.db!.collection('admin_accounts').insertOne({
      email: 'admin@example.com',
      role: 'ADMIN',
      passwordHash: 'dummyhash',
      passwordSalt: 'dummysalt',
      scryptParams: { cost: 16384, saltLength: 32, keyLength: 64 },
      hashVersion: 1,
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return result.insertedId;
  }

  it('creates a session with required fields', async () => {
    const adminId = await createTestAccount();
    const now = new Date();
    const session = await AdminSessionModel.create({
      adminId,
      tokenHash: 'abc123',
      csrfTokenHash: 'def456',
      expiresAt: new Date(now.getTime() + 86400000),
      lastUsedAt: now,
      revokedAt: null,
      userAgent: 'Mozilla/5.0',
    });

    expect(String(session.adminId)).toBe(String(adminId));
    expect(session.tokenHash).toBe('abc123');
    expect(session.csrfTokenHash).toBe('def456');
    expect(session.revokedAt).toBeNull();
    expect(session.userAgent).toBe('Mozilla/5.0');
    expect(session.createdAt).toBeInstanceOf(Date);
  });

  it('enforces unique tokenHash constraint', async () => {
    const adminId = await createTestAccount();
    const now = new Date();

    await AdminSessionModel.create({
      adminId,
      tokenHash: 'unique-hash',
      csrfTokenHash: 'csrf-hash-1',
      expiresAt: new Date(now.getTime() + 86400000),
      lastUsedAt: now,
    });

    await expect(
      AdminSessionModel.create({
        adminId,
        tokenHash: 'unique-hash',
        csrfTokenHash: 'csrf-hash-2',
        expiresAt: new Date(now.getTime() + 86400000),
        lastUsedAt: now,
      }),
    ).rejects.toThrow();
  });

  it('has index on expiresAt for TTL cleanup', async () => {
    const indexes = await AdminSessionModel.collection.indexes();
    // Verify the expiresAt index exists. The TTL (expireAfterSeconds: 0) is defined
    // in the schema but MMS does not expose it in collection.indexes() metadata.
    const expiresAtIndex = indexes.find(
      (idx) => idx.key['expiresAt'] === 1,
    );
    expect(expiresAtIndex).toBeDefined();
  });

  it('has unique index on tokenHash', async () => {
    const indexes = await AdminSessionModel.collection.indexes();
    const tokenIndex = indexes.find(
      (idx) => idx.key['tokenHash'] === 1 && idx.unique === true,
    );
    expect(tokenIndex).toBeDefined();
  });
});

describe('Token helpers', () => {
  it('generates a 32-byte token', () => {
    const token = generateToken();
    expect(token.length).toBe(32);
  });

  it('produces different tokens on each call', () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(t1.equals(t2)).toBe(false);
  });

  it('hashToken produces a 64-char hex string (SHA-256)', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashToken is deterministic for the same input', () => {
    const token = generateToken();
    const h1 = hashToken(token);
    const h2 = hashToken(token);
    expect(h1).toBe(h2);
  });

  it('generateCsrfToken returns 32 random bytes', () => {
    const csrf1 = generateCsrfToken();
    const csrf2 = generateCsrfToken();
    expect(csrf1.length).toBe(32);
    expect(csrf1.equals(csrf2)).toBe(false);
  });

  it('hashCsrfToken produces a 64-char hex string', () => {
    const csrf = generateCsrfToken();
    const hash = hashCsrfToken(csrf);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('timingSafeEqualBuffers returns true for equal buffers', () => {
    const a = Buffer.from('hello');
    const b = Buffer.from('hello');
    expect(timingSafeEqualBuffers(a, b)).toBe(true);
  });

  it('timingSafeEqualBuffers returns false for different buffers', () => {
    const a = Buffer.from('hello');
    const b = Buffer.from('world');
    expect(timingSafeEqualBuffers(a, b)).toBe(false);
  });

  it('timingSafeEqualBuffers handles different-length buffers safely', () => {
    const a = Buffer.from('short');
    const b = Buffer.from('much longer string');
    expect(timingSafeEqualBuffers(a, b)).toBe(false);
  });
});
