import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import { WorkerLock } from './worker-lock.js';

describe('WorkerLock', () => {
  let lock: WorkerLock;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    lock = new WorkerLock();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('acquires a lock', async () => {
    const acquired = await lock.acquire({
      lockKey: WorkerLock.SIGMA_MUTATING_RUN,
      owner: 'test-owner-1',
      ttlMs: 60000,
    });

    expect(acquired).toBe(true);
  });

  it('fails to acquire lock when held by another owner', async () => {
    await lock.acquire({
      lockKey: WorkerLock.SIGMA_MUTATING_RUN,
      owner: 'owner-1',
      ttlMs: 60000,
    });

    const acquired = await lock.acquire({
      lockKey: WorkerLock.SIGMA_MUTATING_RUN,
      owner: 'owner-2',
      ttlMs: 60000,
    });

    expect(acquired).toBe(false);
  });

  it('releases a lock', async () => {
    await lock.acquire({
      lockKey: WorkerLock.SIGMA_MUTATING_RUN,
      owner: 'test-owner',
      ttlMs: 60000,
    });

    const released = await lock.release(WorkerLock.SIGMA_MUTATING_RUN, 'test-owner');
    expect(released).toBe(true);

    const isHeld = await lock.isHeld(WorkerLock.SIGMA_MUTATING_RUN);
    expect(isHeld).toBe(false);
  });

  it('extends lock with heartbeat', async () => {
    await lock.acquire({
      lockKey: WorkerLock.SIGMA_MUTATING_RUN,
      owner: 'test-owner',
      ttlMs: 1000,
    });

    const heartbeated = await lock.heartbeat(
      WorkerLock.SIGMA_MUTATING_RUN,
      'test-owner',
      60000,
    );
    expect(heartbeated).toBe(true);

    const owner = await lock.getOwner(WorkerLock.SIGMA_MUTATING_RUN);
    expect(owner).toBe('test-owner');
  });

  it('checks if lock is held', async () => {
    expect(await lock.isHeld(WorkerLock.SIGMA_MUTATING_RUN)).toBe(false);

    await lock.acquire({
      lockKey: WorkerLock.SIGMA_MUTATING_RUN,
      owner: 'test-owner',
      ttlMs: 60000,
    });

    expect(await lock.isHeld(WorkerLock.SIGMA_MUTATING_RUN)).toBe(true);
  });

  it('returns owner of held lock', async () => {
    await lock.acquire({
      lockKey: WorkerLock.SIGMA_MUTATING_RUN,
      owner: 'specific-owner',
      ttlMs: 60000,
    });

    const owner = await lock.getOwner(WorkerLock.SIGMA_MUTATING_RUN);
    expect(owner).toBe('specific-owner');
  });

  it('returns null for unheld lock', async () => {
    const owner = await lock.getOwner(WorkerLock.SIGMA_MUTATING_RUN);
    expect(owner).toBeNull();
  });
});
