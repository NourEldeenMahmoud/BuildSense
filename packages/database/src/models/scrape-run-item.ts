import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type ItemFetchState = 'PENDING' | 'FETCHED' | 'FAILED' | 'SKIPPED';

export type ScrapeFailureKind =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'HTTP_408'
  | 'HTTP_429'
  | 'HTTP_5XX'
  | 'HTTP_4XX'
  | 'ROBOTS_DENIED'
  | 'OFF_DOMAIN_REDIRECT'
  | 'BLOCKED_RESPONSE'
  | 'INVALID_CONTENT_TYPE'
  | 'PARSE_FAILED'
  | 'PERSISTENCE_FAILED'
  | 'PAGINATION_LOOP'
  | 'PAGE_LIMIT_EXCEEDED';

export interface ScrapeRunItemDocument extends Document {
  scrapeRunId: Types.ObjectId;
  canonicalUrl: string;
  categorySeedId?: string;
  discoverySourceUrl?: string;
  fetchState: ItemFetchState;
  attempts: number;
  failureKind?: ScrapeFailureKind;
  snapshotId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const scrapeRunItemSchema = new Schema<ScrapeRunItemDocument>(
  {
    scrapeRunId: { type: Schema.Types.ObjectId, required: true, ref: 'ScrapeRun' },
    canonicalUrl: { type: String, required: true },
    categorySeedId: { type: String },
    discoverySourceUrl: { type: String },
    fetchState: {
      type: String,
      required: true,
      enum: ['PENDING', 'FETCHED', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    attempts: { type: Number, required: true, default: 0 },
    failureKind: {
      type: String,
      enum: [
        'NETWORK',
        'TIMEOUT',
        'HTTP_408',
        'HTTP_429',
        'HTTP_5XX',
        'HTTP_4XX',
        'ROBOTS_DENIED',
        'OFF_DOMAIN_REDIRECT',
        'BLOCKED_RESPONSE',
        'INVALID_CONTENT_TYPE',
        'PARSE_FAILED',
        'PERSISTENCE_FAILED',
        'PAGINATION_LOOP',
        'PAGE_LIMIT_EXCEEDED',
      ],
    },
    snapshotId: { type: Schema.Types.ObjectId, ref: 'RawProductSnapshot' },
  },
  {
    timestamps: true,
  },
);

scrapeRunItemSchema.index({ scrapeRunId: 1, canonicalUrl: 1 }, { unique: true });
scrapeRunItemSchema.index({ scrapeRunId: 1, fetchState: 1 });
scrapeRunItemSchema.index({ scrapeRunId: 1, categorySeedId: 1 });

export const ScrapeRunItemModel = mongoose.model<ScrapeRunItemDocument>(
  'ScrapeRunItem',
  scrapeRunItemSchema,
  'scrape_run_items',
);
