import mongoose, { Schema, type Document } from 'mongoose';

export type ScrapeRunStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIALLY_FAILED'
  | 'FAILED'
  | 'CANCELLED';

export type ScrapeRunStage = 'DISCOVERY' | 'FETCH';

export type ScrapeRunMode = 'FULL' | 'CATEGORY' | 'URL';

export interface CategoryAuditEntry {
  seedId: string;
  pagesProcessed: number;
  productsDiscovered: number;
  completed: boolean;
  failureKind?: string;
}

export interface ScrapeRunDocument extends Document {
  storeCode: 'SIGMA';
  runId: string;
  mode: ScrapeRunMode;
  status: ScrapeRunStatus;
  stage: ScrapeRunStage;
  commandInput?: string;
  robotsDecision?: 'ALLOWED' | 'DENIED' | 'NOT_FOUND';
  healthGates?: Record<string, boolean>;
  summary?: {
    totalDiscovered: number;
    totalFetched: number;
    totalFailed: number;
    totalMissingPrice?: number;
  };
  categoryAudit?: CategoryAuditEntry[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const categoryAuditSubSchema = new Schema(
  {
    seedId: { type: String, required: true },
    pagesProcessed: { type: Number, required: true, default: 0 },
    productsDiscovered: { type: Number, required: true, default: 0 },
    completed: { type: Boolean, required: true, default: false },
    failureKind: { type: String },
  },
  { _id: false },
);

const scrapeRunSchema = new Schema<ScrapeRunDocument>(
  {
    storeCode: { type: String, required: true, enum: ['SIGMA'], default: 'SIGMA' },
    runId: { type: String, required: true },
    mode: { type: String, required: true, enum: ['FULL', 'CATEGORY', 'URL'] },
    status: {
      type: String,
      required: true,
      enum: ['CREATED', 'RUNNING', 'SUCCEEDED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED'],
      default: 'CREATED',
    },
    stage: { type: String, required: true, enum: ['DISCOVERY', 'FETCH'], default: 'DISCOVERY' },
    commandInput: { type: String },
    robotsDecision: { type: String, enum: ['ALLOWED', 'DENIED', 'NOT_FOUND'] },
    healthGates: { type: Schema.Types.Mixed },
    categoryAudit: { type: [categoryAuditSubSchema], default: undefined },
    summary: {
      totalDiscovered: { type: Number, default: 0 },
      totalFetched: { type: Number, default: 0 },
      totalFailed: { type: Number, default: 0 },
      totalMissingPrice: { type: Number, default: undefined },
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

scrapeRunSchema.index({ storeCode: 1, runId: 1 }, { unique: true });
scrapeRunSchema.index({ storeCode: 1, status: 1 });
scrapeRunSchema.index({ storeCode: 1, createdAt: -1 });

export const ScrapeRunModel = mongoose.model<ScrapeRunDocument>(
  'ScrapeRun',
  scrapeRunSchema,
  'scrape_runs',
);
