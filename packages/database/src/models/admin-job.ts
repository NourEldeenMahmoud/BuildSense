import { Schema, model, type Document, type Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Job type and status enums
// ---------------------------------------------------------------------------

export type AdminJobType = 'REPROCESS_CATALOG' | 'BACKFILL_FACTS' | 'REPROCESS_CATEGORY';

export type AdminJobStatus =
  | 'PENDING'
  | 'CLAIMED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface AdminJobDocument extends Document {
  /** Type of job. */
  jobType: AdminJobType;
  /** Current status. */
  status: AdminJobStatus;
  /** Admin who requested this job. */
  requestedBy: Types.ObjectId;
  /** Admin-provided reason. */
  reason: string;
  /** Worker-specific parameters. */
  params: Record<string, unknown>;
  /** Worker identity that claimed this job. */
  claimedBy: string | null;
  /** When claimed. */
  claimedAt: Date | null;
  /** Number of attempts made. */
  attempts: number;
  /** Max allowed attempts. */
  maxAttempts: number;
  /** When the job completed (succeeded, failed, or cancelled). */
  completedAt: Date | null;
  /** Result summary. */
  result: Record<string, unknown> | null;
  /** Error summary on failure. */
  errorSummary: string | null;
  /** Deduplication key — prevents duplicate active jobs of the same type+params. */
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const adminJobSchema = new Schema<AdminJobDocument>(
  {
    jobType: {
      type: String,
      required: true,
      enum: ['REPROCESS_CATALOG', 'BACKFILL_FACTS', 'REPROCESS_CATEGORY'],
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'CLAIMED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
    },
    requestedBy: { type: Schema.Types.ObjectId, required: true, ref: 'AdminAccount' },
    reason: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: () => ({}) },
    claimedBy: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    attempts: { type: Number, required: true, default: 0 },
    maxAttempts: { type: Number, required: true, default: 3 },
    completedAt: { type: Date, default: null },
    result: { type: Schema.Types.Mixed, default: null },
    errorSummary: { type: String, default: null },
    idempotencyKey: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

// Indexes
adminJobSchema.index({ idempotencyKey: 1 }, { unique: true });
adminJobSchema.index({ status: 1, createdAt: -1 });
adminJobSchema.index({ jobType: 1, status: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const AdminJobModel = model<AdminJobDocument>(
  'AdminJob',
  adminJobSchema,
  'admin_jobs',
);
