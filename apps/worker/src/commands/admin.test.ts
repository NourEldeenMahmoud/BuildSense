import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isUnsafePassword,
  validatePassword,
  seedAdminAccount,
  resetAdminPassword,
  type AccountLike,
  type AccountStore,
  type HashFn,
} from './admin.js';

// ---------------------------------------------------------------------------
// In-memory fakes for testing account operations
// ---------------------------------------------------------------------------

function createFakeAccount(overrides: Partial<AccountLike> = {}): AccountLike {
  return {
    passwordHash: 'old-hash',
    passwordSalt: 'old-salt',
    scryptParams: { cost: 16384, saltLength: 16, keyLength: 64 },
    hashVersion: 1,
    disabled: false,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createFakeStore(existing: AccountLike | null = null): AccountStore {
  const saved = existing ? [existing] : [];
  return {
    findOne: vi.fn().mockResolvedValue(existing),
    create: vi.fn().mockImplementation((data: Record<string, unknown>) => {
      const account = createFakeAccount({
        passwordHash: data.passwordHash as string,
        passwordSalt: data.passwordSalt as string,
        scryptParams: data.scryptParams as AccountLike['scryptParams'],
        hashVersion: data.hashVersion as number,
      });
      saved.push(account);
      return Promise.resolve(account);
    }),
  };
}

function createFakeHash(
  result = {
    passwordHash: 'new-hash',
    passwordSalt: 'new-salt',
    scryptParams: { cost: 16384, saltLength: 16, keyLength: 64 },
    hashVersion: 1,
  },
): HashFn {
  return vi.fn().mockResolvedValue(result);
}

// ---------------------------------------------------------------------------
// Unsafe password list
// ---------------------------------------------------------------------------

describe('isUnsafePassword', () => {
  it('rejects empty string', () => {
    expect(isUnsafePassword('')).toBe(true);
  });

  it('rejects "password"', () => {
    expect(isUnsafePassword('password')).toBe(true);
  });

  it('rejects "admin"', () => {
    expect(isUnsafePassword('admin')).toBe(true);
  });

  it('accepts an unknown word like "sigma"', () => {
    expect(isUnsafePassword('sigma')).toBe(false);
  });

  it('accepts a strong password', () => {
    expect(isUnsafePassword('T3st!ngP@ssw0rd#2026')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Password validation
// ---------------------------------------------------------------------------

describe('validatePassword', () => {
  it('returns null for a strong password', () => {
    expect(validatePassword('T3st!ngP@ssw0rd#2026')).toBeNull();
  });

  it('rejects too short', () => {
    expect(validatePassword('Ab1!')).toBe('Password must be at least 8 characters.');
  });

  it('rejects unsafe password', () => {
    expect(validatePassword('password')).toBe(
      'Password is empty or too common. Please choose a stronger password.',
    );
  });

  it('returns null for a valid non-unsafe password', () => {
    expect(validatePassword('MyS3cure!Pass')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// seedAdminAccount behaviour
// ---------------------------------------------------------------------------

describe('seedAdminAccount', () => {
  let store: AccountStore;
  let hash: HashFn;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createFakeStore(null);
    hash = createFakeHash();
  });

  it('creates a new ADMIN account when none exists', async () => {
    const result = await seedAdminAccount('admin@test.com', 'T3st!ngP@ssw0rd#2026', store, hash);

    expect(result.created).toBe(true);
    expect(store.create).toHaveBeenCalledOnce();
    const createCalls = (store.create as ReturnType<typeof vi.fn>).mock.calls;
    expect(createCalls.length).toBe(1);
    const createArg = createCalls[0]![0];
    expect(createArg).toMatchObject({
      email: 'admin@test.com',
      role: 'ADMIN',
      passwordHash: 'new-hash',
      passwordSalt: 'new-salt',
      hashVersion: 1,
    });
    expect(store.findOne).toHaveBeenCalledWith({ email: 'admin@test.com' });
  });

  it('is idempotent — updates existing account without creating a duplicate', async () => {
    const existing = createFakeAccount();
    store = createFakeStore(existing);

    const result = await seedAdminAccount('admin@test.com', 'T3st!ngP@ssw0rd#2026', store, hash);

    expect(result.created).toBe(false);
    expect(store.create).not.toHaveBeenCalled();
    expect(existing.save).toHaveBeenCalledOnce();
    expect(existing.passwordHash).toBe('new-hash');
    expect(existing.passwordSalt).toBe('new-salt');
    expect(existing.hashVersion).toBe(1);
  });

  it('re-enables a disabled account on re-seed', async () => {
    const existing = createFakeAccount({ disabled: true });
    store = createFakeStore(existing);

    const result = await seedAdminAccount('admin@test.com', 'T3st!ngP@ssw0rd#2026', store, hash);

    expect(result.created).toBe(false);
    expect(existing.disabled).toBe(false);
    expect(existing.save).toHaveBeenCalledOnce();
  });

  it('calls hash with the provided password', async () => {
    await seedAdminAccount('admin@test.com', 'T3st!ngP@ssw0rd#2026', store, hash);

    expect(hash).toHaveBeenCalledWith('T3st!ngP@ssw0rd#2026');
  });

  it('propagates hash errors', async () => {
    hash = vi.fn().mockRejectedValue(new Error('hash failed'));

    await expect(
      seedAdminAccount('admin@test.com', 'T3st!ngP@ssw0rd#2026', store, hash),
    ).rejects.toThrow('hash failed');
  });

  it('propagates store errors on create', async () => {
    store.create = vi.fn().mockRejectedValue(new Error('duplicate key'));

    await expect(
      seedAdminAccount('admin@test.com', 'T3st!ngP@ssw0rd#2026', store, hash),
    ).rejects.toThrow('duplicate key');
  });
});

// ---------------------------------------------------------------------------
// resetAdminPassword behaviour
// ---------------------------------------------------------------------------

describe('resetAdminPassword', () => {
  let store: AccountStore;
  let hash: HashFn;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createFakeStore(null);
    hash = createFakeHash();
  });

  it('replaces password for an existing account', async () => {
    const existing = createFakeAccount();
    store = createFakeStore(existing);

    const result = await resetAdminPassword('admin@test.com', 'N3w!P@ssw0rd#2026', store, hash);

    expect(result.updated).toBe(true);
    expect(existing.save).toHaveBeenCalledOnce();
    expect(existing.passwordHash).toBe('new-hash');
    expect(existing.passwordSalt).toBe('new-salt');
    expect(existing.hashVersion).toBe(1);
  });

  it('fails safely when account does not exist', async () => {
    store = createFakeStore(null);

    const result = await resetAdminPassword('unknown@test.com', 'T3st!ngP@ssw0rd#2026', store, hash);

    expect(result.updated).toBe(false);
    expect(hash).not.toHaveBeenCalled();
  });

  it('does not expose password in returned result', async () => {
    const existing = createFakeAccount();
    store = createFakeStore(existing);

    const result = await resetAdminPassword('admin@test.com', 'N3w!P@ssw0rd#2026', store, hash);

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain('N3w!P@ssw0rd#2026');
    expect(resultStr).not.toContain('password');
  });

  it('calls hash with the new password', async () => {
    const existing = createFakeAccount();
    store = createFakeStore(existing);

    await resetAdminPassword('admin@test.com', 'N3w!P@ssw0rd#2026', store, hash);

    expect(hash).toHaveBeenCalledWith('N3w!P@ssw0rd#2026');
  });

  it('propagates hash errors', async () => {
    const existing = createFakeAccount();
    store = createFakeStore(existing);
    hash = vi.fn().mockRejectedValue(new Error('hash failed'));

    await expect(
      resetAdminPassword('admin@test.com', 'N3w!P@ssw0rd#2026', store, hash),
    ).rejects.toThrow('hash failed');
  });

  it('propagates save errors', async () => {
    const existing = createFakeAccount();
    existing.save = vi.fn().mockRejectedValue(new Error('save failed'));
    store = createFakeStore(existing);

    await expect(
      resetAdminPassword('admin@test.com', 'N3w!P@ssw0rd#2026', store, hash),
    ).rejects.toThrow('save failed');
  });
});
