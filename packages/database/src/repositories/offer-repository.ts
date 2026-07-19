import { OfferModel, type OfferDocument } from '../models/offer.js';
import type { Types } from 'mongoose';

export interface CreateOfferInput {
  catalogProductId: Types.ObjectId;
  storeCode: string;
  storeExternalId: string;
  sourceUrl: string;
  price: number | null;
  currency: string | null;
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
}

export type UpsertOfferInput = CreateOfferInput;

export class OfferRepository {
  /**
   * Find an existing offer by store code and external ID (compound unique index).
   * Returns null if no offer exists for this store+externalId pair.
   */
  async findByStoreExternalId(
    storeCode: string,
    storeExternalId: string,
  ): Promise<OfferDocument | null> {
    return OfferModel.findOne({ storeCode, storeExternalId });
  }

  /**
   * Find all offers linked to a specific catalog product.
   */
  async findByCatalogProductId(catalogProductId: Types.ObjectId): Promise<OfferDocument[]> {
    return OfferModel.find({ catalogProductId }).sort({ createdAt: -1 });
  }

  /**
   * Upsert an offer by (storeCode, storeExternalId).
   * Creates a new offer if none exists, or updates the existing one.
   * Returns the persisted offer document.
   */
  async upsert(input: UpsertOfferInput): Promise<OfferDocument> {
    const now = new Date();
    return OfferModel.findOneAndUpdate(
      { storeCode: input.storeCode, storeExternalId: input.storeExternalId },
      {
        $set: {
          catalogProductId: input.catalogProductId,
          sourceUrl: input.sourceUrl,
          price: input.price,
          currency: input.currency,
          availability: input.availability,
          updatedAt: now,
        },
        $setOnInsert: {
          storeCode: input.storeCode,
          storeExternalId: input.storeExternalId,
          createdAt: now,
        },
      },
      { upsert: true, new: true },
    );
  }

  /**
   * Count offers for a specific store.
   */
  async countByStore(storeCode: string): Promise<number> {
    return OfferModel.countDocuments({ storeCode });
  }
}
