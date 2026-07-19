import type { StoreCode } from '@buildsense/contracts';
import { DiscoveredProductModel, type DiscoveredProductDocument } from '../models/discovered-product.js';
import type { Types } from 'mongoose';

export interface UpsertDiscoveredProductInput {
  storeCode: StoreCode;
  canonicalUrl: string;
  scrapeRunId: Types.ObjectId;
  externalId?: string;
}

export class DiscoveredProductRepository {
  async upsert(input: UpsertDiscoveredProductInput): Promise<DiscoveredProductDocument> {
    const now = new Date();
    const update: Record<string, unknown> = {
      $set: {
        lastDiscoveredAt: now,
        lastScrapeRunId: input.scrapeRunId,
        ...(input.externalId !== undefined && { externalId: input.externalId }),
      },
      $setOnInsert: {
        storeCode: input.storeCode,
        canonicalUrl: input.canonicalUrl,
        firstDiscoveredAt: now,
      },
    };
    return DiscoveredProductModel.findOneAndUpdate(
      {
        storeCode: input.storeCode,
        canonicalUrl: input.canonicalUrl,
      },
      update,
      { upsert: true, new: true },
    );
  }

  async updateExternalId(
    storeCode: StoreCode,
    canonicalUrl: string,
    externalId: string,
  ): Promise<DiscoveredProductDocument | null> {
    return DiscoveredProductModel.findOneAndUpdate(
      { storeCode, canonicalUrl },
      { $set: { externalId } },
      { new: true },
    );
  }

  async findByCanonicalUrl(
    storeCode: StoreCode,
    canonicalUrl: string,
  ): Promise<DiscoveredProductDocument | null> {
    return DiscoveredProductModel.findOne({ storeCode, canonicalUrl });
  }

  async countByStore(storeCode: StoreCode): Promise<number> {
    return DiscoveredProductModel.countDocuments({ storeCode });
  }

  async deleteByStore(storeCode: StoreCode): Promise<number> {
    const result = await DiscoveredProductModel.deleteMany({ storeCode });
    return result.deletedCount;
  }
}
