import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AdminAccountModel,
  AdminJobModel,
  hashPassword,
} from '@buildsense/database';

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
  await AdminJobModel.deleteMany({});
  await AdminAccountModel.deleteMany({});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createAdmin(): Promise<mongoose.Types.ObjectId> {
  const hashResult = await hashPassword('password123');
  const admin = await AdminAccountModel.create({
    email: 'admin@example.com',
    role: 'ADMIN',
    passwordHash: hashResult.passwordHash,
    passwordSalt: hashResult.passwordSalt,
    scryptParams: hashResult.scryptParams,
    hashVersion: hashResult.hashVersion,
  });
  return admin._id as mongoose.Types.ObjectId;
}

async function createPendingJob(
  adminId: mongoose.Types.ObjectId,
  overrides?: Partial<{
    jobType: string;
    reason: string;
    params: Record<string, unknown>;
    idempotencyKey: string;
  }>,
): Promise<mongoose.Types.ObjectId> {
  const job = await AdminJobModel.create({
    jobType: overrides?.jobType ?? 'REPROCESS_CATALOG',
    status: 'PENDING',
    requestedBy: adminId,
    reason: overrides?.reason ?? 'Test job',
    params: overrides?.params ?? {},
    idempotencyKey: overrides?.idempotencyKey ?? `test-${Date.now()}-${Math.random()}`,
  });
  return job._id as mongoose.Types.ObjectId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminJob model', () => {
  it('creates a PENDING job with correct defaults', async () => {
    const adminId = await createAdmin();
    const jobId = await createPendingJob(adminId);

    const job = await AdminJobModel.findById(jobId).lean();
    expect(job).not.toBeNull();
    expect(job?.status).toBe('PENDING');
    expect(job?.jobType).toBe('REPROCESS_CATALOG');
    expect(job?.attempts).toBe(0);
    expect(job?.maxAttempts).toBe(3);
    expect(job?.claimedBy).toBeNull();
    expect(job?.claimedAt).toBeNull();
    expect(job?.completedAt).toBeNull();
    expect(job?.result).toBeNull();
    expect(job?.errorSummary).toBeNull();
  });

  it('deduplicates active jobs via idempotencyKey', async () => {
    const adminId = await createAdmin();
    const idempotencyKey = 'REPROCESS_CATALOG:{}';

    await createPendingJob(adminId, { idempotencyKey });

    // Second job with same idempotencyKey should fail due to unique index
    await expect(
      AdminJobModel.create({
        jobType: 'REPROCESS_CATALOG',
        status: 'PENDING',
        requestedBy: adminId,
        reason: 'Duplicate',
        params: {},
        idempotencyKey,
      }),
    ).rejects.toThrow();
  });

  it('allows different idempotencyKeys', async () => {
    const adminId = await createAdmin();

    await createPendingJob(adminId, { idempotencyKey: 'key-1' });
    await createPendingJob(adminId, { idempotencyKey: 'key-2' });

    const count = await AdminJobModel.countDocuments();
    expect(count).toBe(2);
  });

  it('validates status transitions are stored correctly', async () => {
    const adminId = await createAdmin();
    const jobId = await createPendingJob(adminId);

    // Claim
    await AdminJobModel.findByIdAndUpdate(jobId, {
      $set: { status: 'CLAIMED', claimedBy: 'worker-1', claimedAt: new Date() },
      $inc: { attempts: 1 },
    });

    let job = await AdminJobModel.findById(jobId).lean();
    expect(job?.status).toBe('CLAIMED');
    expect(job?.claimedBy).toBe('worker-1');
    expect(job?.attempts).toBe(1);

    // Run
    await AdminJobModel.findByIdAndUpdate(jobId, { $set: { status: 'RUNNING' } });

    job = await AdminJobModel.findById(jobId).lean();
    expect(job?.status).toBe('RUNNING');

    // Complete
    await AdminJobModel.findByIdAndUpdate(jobId, {
      $set: { status: 'SUCCEEDED', completedAt: new Date() },
    });

    job = await AdminJobModel.findById(jobId).lean();
    expect(job?.status).toBe('SUCCEEDED');
    expect(job?.completedAt).not.toBeNull();
  });

  it('stores errorSummary on failure', async () => {
    const adminId = await createAdmin();
    const jobId = await createPendingJob(adminId);

    await AdminJobModel.findByIdAndUpdate(jobId, {
      $set: {
        status: 'FAILED',
        completedAt: new Date(),
        errorSummary: 'Unsupported operation',
      },
    });

    const job = await AdminJobModel.findById(jobId).lean();
    expect(job?.status).toBe('FAILED');
    expect(job?.errorSummary).toBe('Unsupported operation');
    expect(job?.completedAt).not.toBeNull();
  });

  it('atomic claim returns the claimed job', async () => {
    const adminId = await createAdmin();
    const jobId = await createPendingJob(adminId);

    // Atomic findOneAndUpdate claim
    const claimed = await AdminJobModel.findOneAndUpdate(
      { status: 'PENDING', _id: jobId },
      {
        $set: { status: 'CLAIMED', claimedBy: 'worker-1', claimedAt: new Date() },
        $inc: { attempts: 1 },
      },
      { new: true },
    );

    expect(claimed).not.toBeNull();
    expect(claimed?.status).toBe('CLAIMED');
    expect(claimed?.claimedBy).toBe('worker-1');
    expect(claimed?.attempts).toBe(1);
  });

  it('atomic claim fails if already claimed', async () => {
    const adminId = await createAdmin();
    const jobId = await createPendingJob(adminId);

    // First claim
    await AdminJobModel.findOneAndUpdate(
      { status: 'PENDING', _id: jobId },
      {
        $set: { status: 'CLAIMED', claimedBy: 'worker-1', claimedAt: new Date() },
        $inc: { attempts: 1 },
      },
      { new: true },
    );

    // Second claim should return null
    const secondClaim = await AdminJobModel.findOneAndUpdate(
      { status: 'PENDING', _id: jobId },
      {
        $set: { status: 'CLAIMED', claimedBy: 'worker-2', claimedAt: new Date() },
        $inc: { attempts: 1 },
      },
      { new: true },
    );

    expect(secondClaim).toBeNull();
  });

  it('re-queues job when max attempts not reached', async () => {
    const adminId = await createAdmin();
    const jobId = await createPendingJob(adminId);

    // Claim (attempts becomes 1)
    await AdminJobModel.findByIdAndUpdate(jobId, {
      $set: { status: 'CLAIMED', claimedBy: 'worker-1', claimedAt: new Date() },
      $inc: { attempts: 1 },
    });

    // Simulate failure and re-queue (maxAttempts=3, only 1 attempt so far)
    await AdminJobModel.findByIdAndUpdate(jobId, {
      $set: { status: 'PENDING' },
      $unset: { claimedBy: 1, claimedAt: 1 },
    });

    const job = await AdminJobModel.findById(jobId).lean();
    expect(job?.status).toBe('PENDING');
    expect(job?.claimedBy).toBeUndefined();
    expect(job?.attempts).toBe(1);
  });

  it('marks FAILED when max attempts reached', async () => {
    const adminId = await createAdmin();
    const jobId = await createPendingJob(adminId);

    // Simulate 3 attempts
    await AdminJobModel.findByIdAndUpdate(jobId, {
      $set: {
        status: 'FAILED',
        completedAt: new Date(),
        errorSummary: 'Failed after 3 attempts',
        attempts: 3,
      },
    });

    const job = await AdminJobModel.findById(jobId).lean();
    expect(job?.status).toBe('FAILED');
    expect(job?.completedAt).not.toBeNull();
    expect(job?.errorSummary).toBe('Failed after 3 attempts');
  });

  it('requeue preserves errorSummary and resets completedAt + claim fields', async () => {
    const adminId = await createAdmin();
    const jobId = await createPendingJob(adminId);

    // Simulate claim (attempts becomes 1)
    await AdminJobModel.findByIdAndUpdate(jobId, {
      $set: { status: 'CLAIMED', claimedBy: 'worker-1', claimedAt: new Date() },
      $inc: { attempts: 1 },
    });

    // Simulate failure + requeue using the exact single-$set pattern
    // from the worker (after the fix).  maxAttempts=3, only 1 attempt.
    await AdminJobModel.findByIdAndUpdate(jobId, {
      $set: {
        status: 'PENDING',
        completedAt: null,
        errorSummary: 'REPROCESS_CATALOG is not yet supported',
      },
      $unset: { claimedBy: 1, claimedAt: 1 },
    });

    const job = await AdminJobModel.findById(jobId).lean();
    expect(job?.status).toBe('PENDING');
    expect(job?.completedAt).toBeNull();
    expect(job?.errorSummary).toBe('REPROCESS_CATALOG is not yet supported');
    expect(job?.claimedBy).toBeUndefined();
    expect(job?.claimedAt).toBeUndefined();
    expect(job?.attempts).toBe(1);
  });
});
