import crypto from 'node:crypto';
import { Schema, model, type Document, type Model } from 'mongoose';

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface AdminSessionDocument extends Document {
  adminId: Schema.Types.ObjectId;
  tokenHash: string;
  csrfTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const adminSessionSchema = new Schema<AdminSessionDocument>(
  {
    adminId: { type: Schema.Types.ObjectId, required: true, ref: 'AdminAccount' },
    tokenHash: { type: String, required: true },
    csrfTokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Indexes
adminSessionSchema.index({ tokenHash: 1 }, { unique: true });
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const AdminSessionModel: Model<AdminSessionDocument> =
  model<AdminSessionDocument>('AdminSession', adminSessionSchema, 'admin_sessions');

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export function generateToken(): Buffer {
  return crypto.randomBytes(32);
}

export function hashToken(token: Buffer): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateCsrfToken(): Buffer {
  return crypto.randomBytes(32);
}

export function hashCsrfToken(csrfToken: Buffer): string {
  return crypto.createHash('sha256').update(csrfToken).digest('hex');
}

export function timingSafeEqualBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    // Pad the shorter buffer for safe comparison
    const maxLen = Math.max(a.length, b.length);
    const aPadded = Buffer.alloc(maxLen, 0);
    const bPadded = Buffer.alloc(maxLen, 0);
    a.copy(aPadded);
    b.copy(bPadded);
    return crypto.timingSafeEqual(aPadded, bPadded);
  }
  return crypto.timingSafeEqual(a, b);
}
