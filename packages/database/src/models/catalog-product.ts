import { Schema, model, type Document, type Model } from 'mongoose';

// ---------------------------------------------------------------------------
// Compatibility fact sub-schemas (P0-7)
//
// Phase 0 uses proper typed sub-schemas for new writes.  Existing documents
// that contain the legacy `compatibility: {}` shape are read safely because
// every sub-field has a default; Mongoose casts the empty object to one with
// all defaults, which is structurally equivalent to "no facts extracted".
// Phase 2 will backfill and tighten validation.
// ---------------------------------------------------------------------------

const factEvidenceSchema = new Schema(
  {
    sourceLabel: { type: String, required: true },
    rawValue: {
      type: String,
      validate: {
        validator: (v: unknown) => typeof v === 'string',
        message: 'rawValue must be a string (empty string is valid)',
      },
    },
    normalizedValue: { type: String, default: null },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    extractorVersion: { type: String, required: true },
    extractionIssues: { type: [String], default: [] },
  },
  { _id: false },
);

const compatibilityFactSchema = new Schema(
  {
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, default: null },
    evidence: { type: [factEvidenceSchema], default: [] },
  },
  { _id: false },
);

const compatibilityFactSetSchema = new Schema(
  {
    category: { type: String, default: '' },
    extractorVersion: { type: String, default: '' },
    facts: { type: [compatibilityFactSchema], default: [] },
    extractedAt: { type: String, default: '' },
    extractionIssues: { type: [String], default: [] },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface CatalogProduct {
  title: string;
  category: string;
  brand: string | null;
  model: string | null;
  mpn: string | null;
  images: string[];
  rawSpecifications: Array<{ label: string; value: string }>;
  compatibility: {
    category: string;
    extractorVersion: string;
    facts: Array<{
      key: string;
      value: unknown;
      evidence: Array<{
        sourceLabel: string;
        rawValue: string;
        normalizedValue: string | null;
        confidence: number;
        extractorVersion: string;
        extractionIssues: string[];
      }>;
    }>;
    extractedAt: string;
    extractionIssues: string[];
  } | null;
  buildEligibility: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  createdAt: Date;
  updatedAt: Date;
}

export type CatalogProductDocument = CatalogProduct & Document;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const catalogProductSchema = new Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    brand: { type: String, default: null },
    model: { type: String, default: null },
    mpn: { type: String, default: null },
    images: { type: [String], default: [] },
    rawSpecifications: [
      {
        label: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    compatibility: { type: compatibilityFactSetSchema, default: null },
    buildEligibility: {
      type: String,
      enum: ['ELIGIBLE', 'NOT_ELIGIBLE'],
      default: 'ELIGIBLE',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
catalogProductSchema.index({ category: 1 });
catalogProductSchema.index({ brand: 1 });

export const CatalogProductModel: Model<CatalogProductDocument> = model<CatalogProductDocument>(
  'CatalogProduct',
  catalogProductSchema
);
