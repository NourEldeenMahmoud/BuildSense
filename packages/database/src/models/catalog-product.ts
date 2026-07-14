import { Schema, model, type Document, type Model } from 'mongoose';

export interface CatalogProduct {
  title: string;
  category: string;
  brand: string | null;
  model: string | null;
  mpn: string | null;
  images: string[];
  rawSpecifications: Array<{ label: string; value: string }>;
  compatibility: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type CatalogProductDocument = CatalogProduct & Document;

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
    compatibility: { type: Schema.Types.Mixed, default: {} },
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
