import { Schema, model, type Document, type Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Severity and status enums
// ---------------------------------------------------------------------------

export type DataQualitySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DataQualityIssueStatus = 'OPEN' | 'RESOLVED' | 'IGNORED';

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface DataQualityIssueDocument extends Document {
  /** What kind of issue was detected. */
  issueType: string;
  /** Severity level. */
  severity: DataQualitySeverity;
  /** Current status. */
  status: DataQualityIssueStatus;
  /** Category this issue belongs to. */
  category: string | null;
  /** Reference to the catalog product with the issue, if applicable. */
  catalogProductId: Types.ObjectId | null;
  /** Reference to the raw snapshot, if applicable. */
  rawSnapshotId: Types.ObjectId | null;
  /** Human-readable description of the issue. */
  description: string;
  /** Admin resolution details. */
  resolvedBy: Types.ObjectId | null;
  resolvedAt: Date | null;
  resolutionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const dataQualityIssueSchema = new Schema<DataQualityIssueDocument>(
  {
    issueType: { type: String, required: true },
    severity: {
      type: String,
      required: true,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'RESOLVED', 'IGNORED'],
      default: 'OPEN',
    },
    category: { type: String, default: null },
    catalogProductId: { type: Schema.Types.ObjectId, default: null, ref: 'CatalogProduct' },
    rawSnapshotId: { type: Schema.Types.ObjectId, default: null, ref: 'RawProductSnapshot' },
    description: { type: String, required: true },
    resolvedBy: { type: Schema.Types.ObjectId, default: null, ref: 'AdminAccount' },
    resolvedAt: { type: Date, default: null },
    resolutionReason: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

// Indexes
dataQualityIssueSchema.index({ status: 1, createdAt: -1 });
dataQualityIssueSchema.index({ issueType: 1 });
dataQualityIssueSchema.index({ category: 1 });
dataQualityIssueSchema.index({ severity: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const DataQualityIssueModel = model<DataQualityIssueDocument>(
  'DataQualityIssue',
  dataQualityIssueSchema,
  'data_quality_issues',
);
