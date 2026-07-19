import type { StoreCode } from '@buildsense/contracts';
import { ScrapeRunModel, type ScrapeRunDocument, type CategoryAuditEntry } from '../models/scrape-run.js';
import type { ScrapeRunStatus, ScrapeRunStage } from '../models/scrape-run.js';

const TERMINAL_STATUSES: readonly ScrapeRunStatus[] = [
  'SUCCEEDED',
  'PARTIALLY_FAILED',
  'FAILED',
  'CANCELLED',
];

export interface CreateScrapeRunInput {
  storeCode: StoreCode;
  runId: string;
  mode: 'FULL' | 'CATEGORY' | 'URL';
  commandInput?: string;
}

export interface UpdateScrapeRunInput {
  status?: ScrapeRunStatus;
  stage?: ScrapeRunStage;
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
}

export class ScrapeRunRepository {
  async create(input: CreateScrapeRunInput): Promise<ScrapeRunDocument> {
    return ScrapeRunModel.create({
      storeCode: input.storeCode,
      runId: input.runId,
      mode: input.mode,
      status: 'CREATED',
      stage: 'DISCOVERY',
      commandInput: input.commandInput,
    });
  }

  async findByRunId(runId: string, storeCode: StoreCode): Promise<ScrapeRunDocument | null> {
    return ScrapeRunModel.findOne({ storeCode, runId });
  }

  async updateByRunId(
    runId: string,
    update: UpdateScrapeRunInput,
    storeCode: StoreCode,
  ): Promise<ScrapeRunDocument | null> {
    if (update.status !== undefined && TERMINAL_STATUSES.includes(update.status)) {
      return ScrapeRunModel.findOneAndUpdate(
        {
          storeCode,
          runId,
          status: { $nin: TERMINAL_STATUSES },
        },
        { $set: update },
        { new: true },
      );
    }

    return ScrapeRunModel.findOneAndUpdate(
      { storeCode, runId },
      { $set: update },
      { new: true },
    );
  }

  async findResumableRun(
    mode: 'FULL' | 'CATEGORY' | 'URL',
    storeCode: StoreCode,
    commandInput?: string,
  ): Promise<ScrapeRunDocument | null> {
    return ScrapeRunModel.findOne({
      storeCode,
      mode,
      commandInput,
      status: { $in: ['CREATED', 'RUNNING'] },
    }).sort({ createdAt: -1 });
  }

  async findLatestSuccessful(storeCode: StoreCode): Promise<ScrapeRunDocument | null> {
    return ScrapeRunModel.findOne({
      storeCode,
      mode: 'FULL',
      status: 'SUCCEEDED',
    }).sort({ completedAt: -1 });
  }

  async cancelByRunId(runId: string, storeCode: StoreCode): Promise<ScrapeRunDocument | null> {
    return ScrapeRunModel.findOneAndUpdate(
      {
        storeCode,
        runId,
        status: { $in: ['CREATED', 'RUNNING'] },
      },
      {
        $set: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  async upsertCategoryAudit(
    runId: string,
    entry: CategoryAuditEntry,
    storeCode: StoreCode,
  ): Promise<ScrapeRunDocument | null> {
    const filter = { storeCode, runId };

    // Atomic update: replace existing array element matching seedId.
    const updated = await ScrapeRunModel.findOneAndUpdate(
      { ...filter, 'categoryAudit.seedId': entry.seedId },
      { $set: { 'categoryAudit.$': entry } },
      { new: true },
    );
    if (updated) return updated;

    // Entry does not exist yet; push new element.
    const pushed = await ScrapeRunModel.findOneAndUpdate(
      filter,
      { $push: { categoryAudit: entry } },
      { new: true },
    );
    if (!pushed) return null;

    // Guard against concurrent-push race: two handlers may both miss the $set
    // match and both $push, creating a duplicate seedId. Deduplicate if needed.
    const audit = pushed.categoryAudit ?? [];
    const deduped = deduplicateCategoryAudit(audit);
    if (deduped.length < audit.length) {
      return ScrapeRunModel.findOneAndUpdate(
        filter,
        { $set: { categoryAudit: deduped } },
        { new: true },
      );
    }

    return pushed;
  }
}

/**
 * Remove duplicate categoryAudit entries by seedId, keeping the last occurrence.
 * Handles the race condition where two concurrent $push operations each insert
 * the same seedId before either $set can match it.
 */
function deduplicateCategoryAudit(entries: CategoryAuditEntry[]): CategoryAuditEntry[] {
  const bySeed = new Map<string, CategoryAuditEntry>();
  for (const entry of entries) {
    bySeed.set(entry.seedId, entry);
  }
  return Array.from(bySeed.values());
}
