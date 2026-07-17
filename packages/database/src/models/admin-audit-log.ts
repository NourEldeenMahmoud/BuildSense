import { Schema, model, type Document, type Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Action enum — explicit set of auditable mutations
// ---------------------------------------------------------------------------

export type AdminAuditAction =
  | 'match-review.link'
  | 'match-review.ignore'
  | 'match-review.create-product'
  | 'data-quality.resolve'
  | 'eligibility.override'
  | 'job.reprocess-requested';

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface AdminAuditLogDocument extends Document {
  adminId: Types.ObjectId;
  action: AdminAuditAction;
  targetType: string;
  targetId: Types.ObjectId | null;
  reason: string;
  /** Safe before/after metadata — never raw snapshots, passwords, or secrets. */
  metadata: Record<string, unknown>;
  requestId: string | null;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const adminAuditLogSchema = new Schema<AdminAuditLogDocument>(
  {
    adminId: { type: Schema.Types.ObjectId, required: true, ref: 'AdminAccount' },
    action: {
      type: String,
      required: true,
      enum: [
        'match-review.link',
        'match-review.ignore',
        'match-review.create-product',
        'data-quality.resolve',
        'eligibility.override',
        'job.reprocess-requested',
      ],
    },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, default: null },
    reason: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    requestId: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false },
  },
);

// Append-only: prevent update/delete operations at schema level
// Note: findByIdAndUpdate triggers findOneAndUpdate middleware; findByIdAndDelete triggers findOneAndDelete.
adminAuditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('AdminAuditLog is append-only — updates are not permitted');
});
adminAuditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('AdminAuditLog is append-only — deletes are not permitted');
});
adminAuditLogSchema.pre('deleteOne', function () {
  throw new Error('AdminAuditLog is append-only — deletes are not permitted');
});
adminAuditLogSchema.pre('deleteMany', function () {
  throw new Error('AdminAuditLog is append-only — deletes are not permitted');
});

// Indexes
adminAuditLogSchema.index({ adminId: 1 });
adminAuditLogSchema.index({ action: 1 });
adminAuditLogSchema.index({ targetType: 1, targetId: 1 });
adminAuditLogSchema.index({ timestamp: -1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const AdminAuditLogModel = model<AdminAuditLogDocument>(
  'AdminAuditLog',
  adminAuditLogSchema,
  'admin_audit_logs',
);
