import { Schema, model, Types, type Document, type Model } from 'mongoose';

export interface Offer {
  catalogProductId: Types.ObjectId;
  storeCode: string;
  storeExternalId: string;
  sourceUrl: string;
  price: number | null;
  currency: string | null;
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  createdAt: Date;
  updatedAt: Date;
}

export type OfferDocument = Offer & Document;

const offerSchema = new Schema(
  {
    catalogProductId: { type: Schema.Types.ObjectId, ref: 'CatalogProduct', required: true },
    storeCode: { type: String, required: true },
    storeExternalId: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    price: { type: Number, default: null },
    currency: { type: String, default: null },
    availability: {
      type: String,
      enum: ['IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for idempotency
offerSchema.index({ storeCode: 1, storeExternalId: 1 }, { unique: true });
offerSchema.index({ catalogProductId: 1 });

export const OfferModel: Model<OfferDocument> = model<OfferDocument>('Offer', offerSchema);
