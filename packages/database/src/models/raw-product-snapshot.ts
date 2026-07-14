import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type ContentStorage = 'FILE' | 'INLINE' | 'OBJECT_STORAGE';

export type ParseStatus = 'OK' | 'FAILED';

export interface RawProductSnapshotDocument extends Document {
  storeCode: 'SIGMA';
  externalId: string | null;
  canonicalUrl: string;
  sourceUrl: string;
  scrapeRunId: Types.ObjectId;

  fetchedAt: Date;
  httpStatus: number;
  responseContentType: string | null;
  contentSha256: string;
  contentStorage: ContentStorage;
  contentPath?: string;

  parserVersion: string;
  parseStatus: ParseStatus;
  raw: {
    title: string | null;
    priceText: string | null;
    oldPriceText: string | null;
    availabilityText: string | null;
    skuText: string | null;
    brandText: string | null;
    modelText: string | null;
    partNumberText: string | null;
    breadcrumbs: string[];
    specifications: Array<{ label: string; value: string }>;
    imageUrls: string[];
    descriptionText: string | null;
  };

  parseWarnings: string[];
  createdAt: Date;
}

const specificationSubSchema = new Schema(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

const rawSubSchema = new Schema(
  {
    title: { type: String, default: null },
    priceText: { type: String, default: null },
    oldPriceText: { type: String, default: null },
    availabilityText: { type: String, default: null },
    skuText: { type: String, default: null },
    brandText: { type: String, default: null },
    modelText: { type: String, default: null },
    partNumberText: { type: String, default: null },
    breadcrumbs: [{ type: String }],
    specifications: [specificationSubSchema],
    imageUrls: [{ type: String }],
    descriptionText: { type: String, default: null },
  },
  { _id: false },
);

const rawProductSnapshotSchema = new Schema<RawProductSnapshotDocument>(
  {
    storeCode: { type: String, required: true, enum: ['SIGMA'], default: 'SIGMA' },
    externalId: { type: String, default: null },
    canonicalUrl: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    scrapeRunId: { type: Schema.Types.ObjectId, required: true, ref: 'ScrapeRun' },

    fetchedAt: { type: Date, required: true },
    httpStatus: { type: Number, required: true },
    responseContentType: { type: String, default: null },
    contentSha256: { type: String, required: true },
    contentStorage: {
      type: String,
      required: true,
      enum: ['FILE', 'INLINE', 'OBJECT_STORAGE'],
    },
    contentPath: { type: String },

    parserVersion: { type: String, required: true },
    parseStatus: { type: String, required: true, enum: ['OK', 'FAILED'], default: 'OK' },
    raw: { type: rawSubSchema, required: true },

    parseWarnings: [{ type: String }],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

rawProductSnapshotSchema.index({ storeCode: 1, externalId: 1, fetchedAt: -1 });
rawProductSnapshotSchema.index({ scrapeRunId: 1 });
rawProductSnapshotSchema.index({ contentSha256: 1 });
rawProductSnapshotSchema.index({ canonicalUrl: 1, fetchedAt: -1 });

export const RawProductSnapshotModel = mongoose.model<RawProductSnapshotDocument>(
  'RawProductSnapshot',
  rawProductSnapshotSchema,
  'raw_product_snapshots',
);
