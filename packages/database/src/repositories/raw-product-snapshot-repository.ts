import type { StoreCode } from '@buildsense/contracts';
import { RawProductSnapshotModel, type RawProductSnapshotDocument } from '../models/raw-product-snapshot.js';
import type { Types } from 'mongoose';

export interface CreateRawProductSnapshotInput {
  storeCode: StoreCode;
  externalId: string | null;
  canonicalUrl: string;
  sourceUrl: string;
  scrapeRunId: Types.ObjectId;
  fetchedAt: Date;
  httpStatus: number;
  responseContentType: string | null;
  contentSha256: string;
  contentStorage: 'FILE' | 'INLINE' | 'OBJECT_STORAGE';
  contentPath?: string;
  parserVersion: string;
  parseStatus: 'OK' | 'FAILED';
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
}

export class RawProductSnapshotRepository {
  async findById(id: string): Promise<RawProductSnapshotDocument | null> {
    return RawProductSnapshotModel.findById(id);
  }

  async insert(input: CreateRawProductSnapshotInput): Promise<RawProductSnapshotDocument> {
    return RawProductSnapshotModel.create(input);
  }

  async findByRunId(scrapeRunId: Types.ObjectId): Promise<RawProductSnapshotDocument[]> {
    return RawProductSnapshotModel.find({ scrapeRunId }).sort({ fetchedAt: -1 });
  }

  async findByCanonicalUrl(
    canonicalUrl: string,
    limit = 10,
  ): Promise<RawProductSnapshotDocument[]> {
    return RawProductSnapshotModel.find({ canonicalUrl })
      .sort({ fetchedAt: -1 })
      .limit(limit);
  }

  async findByExternalId(
    externalId: string,
    limit = 10,
  ): Promise<RawProductSnapshotDocument[]> {
    return RawProductSnapshotModel.find({ externalId })
      .sort({ fetchedAt: -1 })
      .limit(limit);
  }

  async findByContentSha256(
    contentSha256: string,
    scrapeRunId: Types.ObjectId,
  ): Promise<RawProductSnapshotDocument | null> {
    return RawProductSnapshotModel.findOne({
      contentSha256,
      scrapeRunId,
    });
  }

  async countByRunId(scrapeRunId: Types.ObjectId): Promise<number> {
    return RawProductSnapshotModel.countDocuments({ scrapeRunId });
  }

  async countByParseStatus(
    scrapeRunId: Types.ObjectId,
  ): Promise<{ ok: number; failed: number }> {
    const results = await RawProductSnapshotModel.aggregate([
      { $match: { scrapeRunId } },
      { $group: { _id: '$parseStatus', count: { $sum: 1 } } },
    ]);

    const counts = { ok: 0, failed: 0 };
    for (const result of results) {
      if (result._id === 'OK') counts.ok = result.count;
      if (result._id === 'FAILED') counts.failed = result.count;
    }
    return counts;
  }

  async findLatestSuccessful(storeCode: StoreCode): Promise<RawProductSnapshotDocument | null> {
    return RawProductSnapshotModel.findOne({
      storeCode,
      parseStatus: 'OK',
    }).sort({ fetchedAt: -1 });
  }

  async countMissingPricesByRunId(scrapeRunId: Types.ObjectId): Promise<{ missing: number; total: number }> {
    const results = await RawProductSnapshotModel.aggregate([
      { $match: { scrapeRunId, parseStatus: 'OK' } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          missing: {
            $sum: {
              $cond: {
                if: {
                  $or: [
                    { $eq: ['$raw.priceText', null] },
                    { $eq: ['$raw.priceText', ''] },
                    { $eq: [{ $trim: { input: '$raw.priceText' } }, ''] },
                  ],
                },
                then: 1,
                else: 0,
              },
            },
          },
        },
      },
    ]);

    if (results.length === 0) {
      return { missing: 0, total: 0 };
    }

    return { missing: results[0].missing, total: results[0].total };
  }
}
