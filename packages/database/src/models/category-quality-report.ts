import { Schema, model, type Document, type Model } from 'mongoose';

// ---------------------------------------------------------------------------
// CategoryQualityReport — P0-9
//
// Separate collection keyed by (category, extractorVersion).
// Written by worker in Phase 2; read-only from API.
// Quality gate thresholds: coverage >=80%, precision >=95%, sample >=50 or all.
// ---------------------------------------------------------------------------

// -- Sub-document interfaces ------------------------------------------------

export interface FactQualityMetrics {
  factKey: string;
  extractableCount: number;
  coverage: number;
  verifiedCorrect: number | null;
  verifiedSampleSize: number | null;
  precision: number | null;
}

export interface CategoryQualityReport {
  category: string;
  extractorVersion: string;
  totalProducts: number;
  factMetrics: FactQualityMetrics[];
  allGatesPass: boolean;
  evaluatedAt: Date;
}

export type CategoryQualityReportDocument = CategoryQualityReport & Document;

// -- Sub-schemas ------------------------------------------------------------

const factQualityMetricsSchema = new Schema(
  {
    factKey: { type: String, required: true },
    extractableCount: { type: Number, required: true, min: 0 },
    coverage: { type: Number, required: true, min: 0, max: 1 },
    verifiedCorrect: { type: Number, default: null, min: 0 },
    verifiedSampleSize: { type: Number, default: null, min: 0 },
    precision: { type: Number, default: null, min: 0, max: 1 },
  },
  { _id: false },
);

// -- Main schema ------------------------------------------------------------

const categoryQualityReportSchema = new Schema(
  {
    category: { type: String, required: true },
    extractorVersion: { type: String, required: true },
    totalProducts: { type: Number, required: true, min: 0 },
    factMetrics: { type: [factQualityMetricsSchema], default: [] },
    allGatesPass: { type: Boolean, required: true, default: false },
    evaluatedAt: { type: Date, required: true },
  },
  {
    timestamps: false,
  },
);

// Compound unique index: one report per (category, extractorVersion)
categoryQualityReportSchema.index(
  { category: 1, extractorVersion: 1 },
  { unique: true },
);

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const CategoryQualityReportModel: Model<CategoryQualityReportDocument> =
  model<CategoryQualityReportDocument>(
    'CategoryQualityReport',
    categoryQualityReportSchema,
  );
