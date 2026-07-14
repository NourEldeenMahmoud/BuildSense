import mongoose, { Schema, type Document } from 'mongoose';

export interface WorkerLockDocument extends Document {
  lockKey: string;
  owner: string;
  expiresAt: Date;
  createdAt: Date;
}

const workerLockSchema = new Schema<WorkerLockDocument>(
  {
    lockKey: { type: String, required: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
);

workerLockSchema.index({ lockKey: 1 }, { unique: true });
workerLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const WorkerLockModel = mongoose.model<WorkerLockDocument>(
  'WorkerLock',
  workerLockSchema,
  'worker_locks',
);

export interface AcquireLockInput {
  lockKey: string;
  owner: string;
  ttlMs: number;
}

export class WorkerLock {
  static readonly SIGMA_MUTATING_RUN = 'SIGMA_MUTATING_RUN';

  async acquire(input: AcquireLockInput): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.ttlMs);

    const existing = await WorkerLockModel.findOne({
      lockKey: input.lockKey,
      expiresAt: { $gt: now },
    });

    if (existing) {
      return false;
    }

    const result = await WorkerLockModel.findOneAndUpdate(
      {
        lockKey: input.lockKey,
        $or: [
          { expiresAt: { $lt: now } },
          { expiresAt: { $exists: false } },
        ],
      },
      {
        $set: {
          lockKey: input.lockKey,
          owner: input.owner,
          expiresAt,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );

    return result.owner === input.owner;
  }

  async release(lockKey: string, owner: string): Promise<boolean> {
    const result = await WorkerLockModel.findOneAndDelete({
      lockKey,
      owner,
    });

    return result !== null;
  }

  async heartbeat(lockKey: string, owner: string, ttlMs: number): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    const result = await WorkerLockModel.findOneAndUpdate(
      {
        lockKey,
        owner,
        expiresAt: { $gt: now },
      },
      {
        $set: { expiresAt },
      },
      { new: true },
    );

    return result !== null;
  }

  async isHeld(lockKey: string): Promise<boolean> {
    const now = new Date();
    const lock = await WorkerLockModel.findOne({
      lockKey,
      expiresAt: { $gt: now },
    });
    return lock !== null;
  }

  async getOwner(lockKey: string): Promise<string | null> {
    const now = new Date();
    const lock = await WorkerLockModel.findOne({
      lockKey,
      expiresAt: { $gt: now },
    });
    return lock?.owner ?? null;
  }
}
