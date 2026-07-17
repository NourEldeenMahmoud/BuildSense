import { Schema, model, type Document, type Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface EligibilityOverrideDocument extends Document {
  /** The catalog product whose eligibility was overridden. */
  productId: Types.ObjectId;
  /** Previous eligibility value before this override. */
  previousEligibility: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  /** New eligibility value after this override. */
  newEligibility: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  /** Admin who performed the override. */
  adminId: Types.ObjectId;
  /** Reason for the override. */
  reason: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const eligibilityOverrideSchema = new Schema<EligibilityOverrideDocument>(
  {
    productId: { type: Schema.Types.ObjectId, required: true, ref: 'CatalogProduct' },
    previousEligibility: {
      type: String,
      required: true,
      enum: ['ELIGIBLE', 'NOT_ELIGIBLE'],
    },
    newEligibility: {
      type: String,
      required: true,
      enum: ['ELIGIBLE', 'NOT_ELIGIBLE'],
    },
    adminId: { type: Schema.Types.ObjectId, required: true, ref: 'AdminAccount' },
    reason: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Indexes
eligibilityOverrideSchema.index({ productId: 1, createdAt: -1 });
eligibilityOverrideSchema.index({ adminId: 1 });
eligibilityOverrideSchema.index({ createdAt: -1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const EligibilityOverrideModel = model<EligibilityOverrideDocument>(
  'EligibilityOverride',
  eligibilityOverrideSchema,
  'eligibility_overrides',
);
