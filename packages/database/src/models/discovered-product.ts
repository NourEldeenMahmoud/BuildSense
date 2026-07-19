import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { StoreCode } from '@buildsense/contracts';

export interface DiscoveredProductDocument extends Document {
  storeCode: StoreCode;
  canonicalUrl: string;
  externalId: string | null;
  firstDiscoveredAt: Date;
  lastDiscoveredAt: Date;
  lastScrapeRunId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const discoveredProductSchema = new Schema<DiscoveredProductDocument>(
  {
    storeCode: { type: String, required: true, enum: ['SIGMA', 'EL_NOUR', 'EL_BADR', 'ALFRENSIA'], default: 'SIGMA' },
    canonicalUrl: { type: String, required: true },
    externalId: { type: String, default: null },
    firstDiscoveredAt: { type: Date, required: true },
    lastDiscoveredAt: { type: Date, required: true },
    lastScrapeRunId: { type: Schema.Types.ObjectId, required: true, ref: 'ScrapeRun' },
  },
  {
    timestamps: true,
  },
);

discoveredProductSchema.index(
  { storeCode: 1, canonicalUrl: 1 },
  { unique: true },
);

discoveredProductSchema.index({ storeCode: 1, externalId: 1 });

export const DiscoveredProductModel = mongoose.model<DiscoveredProductDocument>(
  'DiscoveredProduct',
  discoveredProductSchema,
  'discovered_products',
);
