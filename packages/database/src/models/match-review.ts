import { Schema, model, type Document, type Types } from 'mongoose';
import type { StoreCode } from '@buildsense/contracts';

// ---------------------------------------------------------------------------
// Status enum
// ---------------------------------------------------------------------------

export type MatchReviewStatus = 'PENDING' | 'LINKED' | 'IGNORED' | 'CREATED_PRODUCT';

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface MatchReviewDocument extends Document {
  /** Reference to the raw product snapshot this review concerns. */
  rawSnapshotId: Types.ObjectId;
  /** Detected canonical URL of the scraped product. */
  canonicalUrl: string;
  /** Store code. */
  storeCode: StoreCode;
  /** Current resolution status. */
  status: MatchReviewStatus;
  /** When resolved (linked/ignored/created). Null while pending. */
  resolvedAt: Date | null;
  /** Admin who resolved this review. Null while pending. */
  resolvedBy: Types.ObjectId | null;
  /** Reason provided by admin on resolution. */
  resolutionReason: string | null;
  /** If linked, the catalog product it was linked to. */
  linkedProductId: Types.ObjectId | null;
  /** If created-product, the new catalog product ID. */
  createdProductId: Types.ObjectId | null;
  /** Summary of why this review was flagged (auto-generated). */
  flagReason: string;
  /** Optional category hint from the scraper. */
  suggestedCategory: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const matchReviewSchema = new Schema<MatchReviewDocument>(
  {
    rawSnapshotId: { type: Schema.Types.ObjectId, required: true, ref: 'RawProductSnapshot' },
    canonicalUrl: { type: String, required: true },
    storeCode: { type: String, required: true, enum: ['SIGMA', 'EL_NOUR', 'EL_BADR', 'ALFRENSIA'], default: 'SIGMA' },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'LINKED', 'IGNORED', 'CREATED_PRODUCT'],
      default: 'PENDING',
    },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, default: null, ref: 'AdminAccount' },
    resolutionReason: { type: String, default: null },
    linkedProductId: { type: Schema.Types.ObjectId, default: null, ref: 'CatalogProduct' },
    createdProductId: { type: Schema.Types.ObjectId, default: null, ref: 'CatalogProduct' },
    flagReason: { type: String, required: true },
    suggestedCategory: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

// Indexes
matchReviewSchema.index({ status: 1, createdAt: -1 });
matchReviewSchema.index({ rawSnapshotId: 1 });
matchReviewSchema.index({ canonicalUrl: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const MatchReviewModel = model<MatchReviewDocument>(
  'MatchReview',
  matchReviewSchema,
  'match_reviews',
);
