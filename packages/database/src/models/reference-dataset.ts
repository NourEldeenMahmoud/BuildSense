import { Schema, model, type Document, type Model } from 'mongoose';

// ---------------------------------------------------------------------------
// ReferenceDataset — P0-10
//
// Versioned authoritative reference data. Keyed by unique version string.
// chipsetCpuSupport starts as an empty array — no fabricated support data.
// CMP-CPU-MB-002 returns UNKNOWN until this dataset has >=1 entry.
// ---------------------------------------------------------------------------

// -- Sub-document interfaces ------------------------------------------------

export interface ChipsetCpuSupportEntry {
  chipset: string;
  supportedFamilies: string[];
  biosUpdateRequired: string[];
  source: string;
  verifiedAt: Date;
}

export interface ReferenceDataset {
  version: string;
  publishedAt: Date;
  chipsetCpuSupport: ChipsetCpuSupportEntry[];
  citation: string;
}

export type ReferenceDatasetDocument = ReferenceDataset & Document;

// -- Sub-schemas ------------------------------------------------------------

const chipsetCpuSupportEntrySchema = new Schema(
  {
    chipset: { type: String, required: true },
    supportedFamilies: { type: [String], default: [] },
    biosUpdateRequired: { type: [String], default: [] },
    source: { type: String, required: true },
    verifiedAt: { type: Date, required: true },
  },
  { _id: false },
);

// -- Main schema ------------------------------------------------------------

const referenceDatasetSchema = new Schema(
  {
    version: { type: String, required: true, unique: true },
    publishedAt: { type: Date, required: true },
    chipsetCpuSupport: { type: [chipsetCpuSupportEntrySchema], default: [] },
    citation: { type: String, required: true },
  },
  {
    timestamps: false,
  },
);

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const ReferenceDatasetModel: Model<ReferenceDatasetDocument> =
  model<ReferenceDatasetDocument>(
    'ReferenceDataset',
    referenceDatasetSchema,
  );
