import { ScrapeRunItemModel, type ScrapeRunItemDocument } from '../models/scrape-run-item.js';
import type { Types } from 'mongoose';
import type { ItemFetchState, ScrapeFailureKind } from '../models/scrape-run-item.js';

export interface CreateScrapeRunItemInput {
  scrapeRunId: Types.ObjectId;
  canonicalUrl: string;
  categorySeedId?: string;
  discoverySourceUrl?: string;
}

export interface UpdateScrapeRunItemInput {
  fetchState?: ItemFetchState;
  attempts?: number;
  failureKind?: ScrapeFailureKind;
  snapshotId?: Types.ObjectId;
}

export class ScrapeRunItemRepository {
  async upsert(input: CreateScrapeRunItemInput): Promise<ScrapeRunItemDocument> {
    return ScrapeRunItemModel.findOneAndUpdate(
      {
        scrapeRunId: input.scrapeRunId,
        canonicalUrl: input.canonicalUrl,
      },
      {
        $setOnInsert: {
          scrapeRunId: input.scrapeRunId,
          canonicalUrl: input.canonicalUrl,
          categorySeedId: input.categorySeedId,
          discoverySourceUrl: input.discoverySourceUrl,
          fetchState: 'PENDING',
          attempts: 0,
        },
      },
      { upsert: true, new: true },
    );
  }

  async updateByCanonicalUrl(
    scrapeRunId: Types.ObjectId,
    canonicalUrl: string,
    update: UpdateScrapeRunItemInput,
  ): Promise<ScrapeRunItemDocument | null> {
    return ScrapeRunItemModel.findOneAndUpdate(
      { scrapeRunId, canonicalUrl },
      { $set: update },
      { new: true },
    );
  }

  async findByRunId(scrapeRunId: Types.ObjectId): Promise<ScrapeRunItemDocument[]> {
    return ScrapeRunItemModel.find({ scrapeRunId }).sort({ createdAt: 1 });
  }

  async findPendingByRunId(scrapeRunId: Types.ObjectId): Promise<ScrapeRunItemDocument[]> {
    return ScrapeRunItemModel.find({
      scrapeRunId,
      fetchState: 'PENDING',
    }).sort({ createdAt: 1 });
  }

  async findFailedByRunId(scrapeRunId: Types.ObjectId): Promise<ScrapeRunItemDocument[]> {
    return ScrapeRunItemModel.find({
      scrapeRunId,
      fetchState: 'FAILED',
    });
  }

  async countByState(
    scrapeRunId: Types.ObjectId,
  ): Promise<Record<ItemFetchState, number>> {
    const results = await ScrapeRunItemModel.aggregate([
      { $match: { scrapeRunId } },
      { $group: { _id: '$fetchState', count: { $sum: 1 } } },
    ]);

    const counts: Record<ItemFetchState, number> = {
      PENDING: 0,
      FETCHED: 0,
      FAILED: 0,
      SKIPPED: 0,
    };

    for (const result of results) {
      counts[result._id as ItemFetchState] = result.count;
    }

    return counts;
  }

  async existsByRunIdAndUrl(
    scrapeRunId: Types.ObjectId,
    canonicalUrl: string,
  ): Promise<boolean> {
    const item = await ScrapeRunItemModel.findOne({
      scrapeRunId,
      canonicalUrl,
    }).select('_id');
    return item !== null;
  }
}
