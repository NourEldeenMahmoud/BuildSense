import { type StoreScraperAdapter } from '@buildsense/contracts';
import type {
  ScrapeRunRepository,
  ScrapeRunItemRepository,
  RawProductSnapshotRepository,
  DiscoveredProductRepository,
  WorkerLock,
  CreateScrapeRunItemInput,
  ScrapeRunDocument,
  ScrapeRunItemDocument,
  ScrapeFailureKind,
  ScrapeRunMode,
} from '@buildsense/database';
import type { SnapshotStore } from './snapshot-store.js';
import { evaluateRobotsPolicy } from './robots-evaluator.js';

import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { Types } from 'mongoose';

const DEFAULT_USER_AGENT = 'BuildSense/0.1.0 (github.com/NourEldeenMahmoud/BuildSense)';
const DEFAULT_TIMEOUT_MS = 15000;

export interface BootstrapImportConfig {
  adapter: StoreScraperAdapter;
  snapshotStore: SnapshotStore;
  runRepository: ScrapeRunRepository;
  itemRepository: ScrapeRunItemRepository;
  snapshotRepository: RawProductSnapshotRepository;
  discoveredProductRepository: DiscoveredProductRepository;
  workerLock: WorkerLock;
  baseUrl: string;
  manifestBaseDir: string;
  snapshotBaseDir: string;
  lockTtlMs?: number;
  maxRetries?: number;
  requestTimeoutMs?: number;
  userAgent?: string;
}

export interface BootstrapImportCommand {
  runId?: string;
  seedId?: string;
}

export interface BootstrapCategoryManifest {
  seedId: string;
  categoryUrl: string;
  totalItems: number;
  expectedPages: number;
  generatedPages: number;
  processedPages: number;
  missingPages: string[];
}

export interface BootstrapImportManifest {
  runId: string;
  captureTimestamp: string;
  bootstrapStatus: 'COMPLETE' | 'INCOMPLETE';
  enabledCategories: string[];
  categories: BootstrapCategoryManifest[];
  pageTotals: {
    expected: number;
    generated: number;
    processed: number;
    missing: number;
  };
  productUrls: {
    extracted: number;
    unique: number;
    duplicates: number;
  };
  fetch: {
    successful: number;
    failed: number;
    skippedOrResumed: number;
    duplicateLogicalFetches: number;
  };
  snapshots: {
    parsed: number;
    parseFailed: number;
    storageLocation: string;
    missingRequiredSnapshots: number;
  };
  deferredWork: string[];
  m2Bug001Deferred: true;
  manifestPath: string;
  auditPath: string;
}

export interface BootstrapImportResult {
  runId: string;
  bootstrapStatus: 'COMPLETE' | 'INCOMPLETE';
  manifestPath: string;
  auditPath: string;
  manifest: BootstrapImportManifest;
}

interface CategoryProgress {
  seedId: string;
  categoryUrl: string;
  totalItems: number;
  expectedPages: number;
  generatedPageUrls: string[];
  processedPageUrls: Set<string>;
  extractedUrls: string[];
}

interface FetchPlan {
  scheduled: string[];
  skippedOrResumed: number;
  duplicateLogicalFetches: number;
}

interface FetchOutcome {
  successful: number;
  failed: number;
  parsedSnapshots: number;
  parseFailedSnapshots: number;
}

interface PersistedFetchSummary {
  uniqueUrls: number;
  successful: number;
  failed: number;
  skipped: number;
  parsedSnapshots: number;
  parseFailedSnapshots: number;
}

export function calculateExpectedPages(totalItems: number, perPage = 16): number {
  if (totalItems <= 0) return 1;
  return Math.ceil(totalItems / perPage);
}

export function generateCategoryPageUrls(categoryUrl: string, expectedPages: number): string[] {
  if (expectedPages <= 0) return [];

  const first = new URL(categoryUrl);
  const urls: string[] = [];

  for (let page = 1; page <= expectedPages; page++) {
    const pageUrl = new URL(first);
    if (page > 1) {
      pageUrl.searchParams.set('page', String(page));
    } else {
      pageUrl.searchParams.delete('page');
    }
    urls.push(pageUrl.href);
  }

  return urls;
}

export function computeMissingPages(generated: string[], processed: Iterable<string>): string[] {
  const processedSet = new Set(processed);
  return generated.filter((url) => !processedSet.has(url));
}

export function dedupeCanonicalUrls(urls: string[]): {
  uniqueUrls: string[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  const unique: string[] = [];
  let duplicateCount = 0;

  for (const url of urls) {
    if (seen.has(url)) {
      duplicateCount++;
      continue;
    }
    seen.add(url);
    unique.push(url);
  }

  return { uniqueUrls: unique, duplicateCount };
}

const RETRY_ELIGIBLE_FAILURE_KINDS = new Set<ScrapeFailureKind>([
  'NETWORK',
  'TIMEOUT',
  'HTTP_408',
  'HTTP_429',
  'HTTP_5XX',
]);

export function isRetryEligibleFailure(failureKind?: ScrapeFailureKind): boolean {
  return failureKind !== undefined && RETRY_ELIGIBLE_FAILURE_KINDS.has(failureKind);
}

export function buildFetchPlan(
  items: Array<{
    canonicalUrl: string;
    fetchState: 'PENDING' | 'FETCHED' | 'FAILED' | 'SKIPPED';
    failureKind?: ScrapeFailureKind;
  }>,
): FetchPlan {
  const itemsByUrl = new Map<string, typeof items>();
  let duplicateLogicalFetches = 0;

  for (const item of items) {
    const matchingItems = itemsByUrl.get(item.canonicalUrl);
    if (matchingItems) {
      matchingItems.push(item);
      duplicateLogicalFetches++;
    } else {
      itemsByUrl.set(item.canonicalUrl, [item]);
    }
  }

  const scheduled: string[] = [];
  let skippedOrResumed = 0;

  for (const [canonicalUrl, matchingItems] of itemsByUrl) {
    const alreadyFetched = matchingItems.some((item) => item.fetchState === 'FETCHED');
    const pending = matchingItems.some((item) => item.fetchState === 'PENDING');
    const retryEligible = matchingItems.some(
      (item) => item.fetchState === 'FAILED' && isRetryEligibleFailure(item.failureKind),
    );

    if (!alreadyFetched && (pending || retryEligible)) {
      scheduled.push(canonicalUrl);
    } else {
      skippedOrResumed++;
    }
  }

  return { scheduled, skippedOrResumed, duplicateLogicalFetches };
}

export function assertBootstrapResumeCompatibility(
  run: Pick<ScrapeRunDocument, 'runId' | 'mode' | 'commandInput'>,
  command: BootstrapImportCommand,
): void {
  const expectedMode: ScrapeRunMode = command.seedId === undefined ? 'FULL' : 'CATEGORY';
  let storedCommand: { mode?: unknown; seedId?: unknown } | null;

  try {
    storedCommand = run.commandInput === undefined ? null : JSON.parse(run.commandInput);
  } catch {
    throw new Error(`Run ${run.runId} has invalid bootstrap command input`);
  }

  if (
    run.mode !== expectedMode ||
    storedCommand?.mode !== 'BOOTSTRAP_IMPORT' ||
    storedCommand.seedId !== command.seedId
  ) {
    throw new Error(`Run ${run.runId} is incompatible with the requested bootstrap mode or seed`);
  }
}

function summarizePersistedFetchState(items: ScrapeRunItemDocument[]): PersistedFetchSummary {
  const itemsByUrl = new Map<string, ScrapeRunItemDocument[]>();

  for (const item of items) {
    const matchingItems = itemsByUrl.get(item.canonicalUrl);
    if (matchingItems) {
      matchingItems.push(item);
    } else {
      itemsByUrl.set(item.canonicalUrl, [item]);
    }
  }

  let successful = 0;
  let failed = 0;
  let skipped = 0;
  let parsedSnapshots = 0;
  let parseFailedSnapshots = 0;

  for (const matchingItems of itemsByUrl.values()) {
    const fetchedItems = matchingItems.filter((item) => item.fetchState === 'FETCHED');
    if (fetchedItems.length > 0) {
      successful++;
      if (fetchedItems.some((item) => item.snapshotId !== undefined)) parsedSnapshots++;
      continue;
    }

    const failedItems = matchingItems.filter((item) => item.fetchState === 'FAILED');
    if (failedItems.length > 0) {
      failed++;
      if (failedItems.some((item) => item.snapshotId !== undefined)) parseFailedSnapshots++;
      continue;
    }

    if (matchingItems.some((item) => item.fetchState === 'SKIPPED')) skipped++;
  }

  return {
    uniqueUrls: itemsByUrl.size,
    successful,
    failed,
    skipped,
    parsedSnapshots,
    parseFailedSnapshots,
  };
}

export function detectSilentSkips(
  totalUnique: number,
  fetched: number,
  failed: number,
  skippedOrResumed: number,
): number {
  const accounted = fetched + failed + skippedOrResumed;
  return Math.max(0, totalUnique - accounted);
}

export class SigmaBootstrapImporter {
  private readonly config: BootstrapImportConfig;

  constructor(config: BootstrapImportConfig) {
    this.config = config;
  }

  async execute(command: BootstrapImportCommand): Promise<BootstrapImportResult> {
    const publicRunId = command.runId ?? crypto.randomUUID();
    const lockOwner = `bootstrap-${publicRunId}`;
    const lockKey = 'SIGMA_MUTATING_RUN';

    const acquired = await this.config.workerLock.acquire({
      lockKey,
      owner: lockOwner,
      ttlMs: this.config.lockTtlMs ?? 300000,
    });

    if (!acquired) {
      throw new Error('Another mutating run is already in progress');
    }

    try {
      const run = await this.getOrCreateRun(publicRunId, command);

      const robots = await evaluateRobotsPolicy({
        baseUrl: this.config.baseUrl,
        userAgent: this.config.userAgent ?? DEFAULT_USER_AGENT,
      });

      await this.config.runRepository.updateByRunId(publicRunId, {
        robotsDecision: robots.decision,
      });

      if (robots.decision === 'DENIED') {
        throw new Error('Robots policy denied bootstrap import');
      }

      const discovery = await this.discoverCategoryPages(publicRunId, command);
      const deduped = dedupeCanonicalUrls(discovery.extractedUrls);

      for (const canonicalUrl of deduped.uniqueUrls) {
        const input: CreateScrapeRunItemInput = {
          scrapeRunId: run._id,
          canonicalUrl,
        };
        await this.config.itemRepository.upsert(input);
      }

      const persistedItems = await this.config.itemRepository.findByRunId(run._id);
      const fetchPlan = buildFetchPlan(
        persistedItems.map((item) => ({
          canonicalUrl: item.canonicalUrl,
          fetchState: item.fetchState,
          ...(item.failureKind !== undefined && { failureKind: item.failureKind }),
        })),
      );

      await this.fetchProducts(run._id, publicRunId, fetchPlan.scheduled);
      const missingRequiredSnapshots = await this.countMissingRequiredSnapshots(run._id);

      const categoriesManifest = discovery.categories.map((category) => ({
        seedId: category.seedId,
        categoryUrl: category.categoryUrl,
        totalItems: category.totalItems,
        expectedPages: category.expectedPages,
        generatedPages: category.generatedPageUrls.length,
        processedPages: category.processedPageUrls.size,
        missingPages: computeMissingPages(category.generatedPageUrls, category.processedPageUrls),
      }));

      const pageExpected = categoriesManifest.reduce((acc, c) => acc + c.expectedPages, 0);
      const pageGenerated = categoriesManifest.reduce((acc, c) => acc + c.generatedPages, 0);
      const pageProcessed = categoriesManifest.reduce((acc, c) => acc + c.processedPages, 0);
      const pageMissing = categoriesManifest.reduce((acc, c) => acc + c.missingPages.length, 0);

      const remainingItems = await this.config.itemRepository.findByRunId(run._id);
      const persistedSummary = summarizePersistedFetchState(remainingItems);
      const silentSkips = detectSilentSkips(
        persistedSummary.uniqueUrls,
        persistedSummary.successful,
        persistedSummary.failed,
        persistedSummary.skipped,
      );

      const hasResumeWork = remainingItems.some(
        (item) =>
          item.fetchState === 'PENDING' ||
          (item.fetchState === 'FAILED' && isRetryEligibleFailure(item.failureKind)),
      );
      const isComplete =
        pageMissing === 0 &&
        pageProcessed >= pageExpected &&
        silentSkips === 0 &&
        fetchPlan.duplicateLogicalFetches === 0 &&
        missingRequiredSnapshots === 0 &&
        !hasResumeWork &&
        categoriesManifest.every((c) => c.missingPages.length === 0);

      const status: 'SUCCEEDED' | 'PARTIALLY_FAILED' =
        persistedSummary.failed > 0 ? 'PARTIALLY_FAILED' : 'SUCCEEDED';

      const outputDir = path.resolve(this.config.manifestBaseDir, publicRunId);
      await mkdir(outputDir, { recursive: true });
      const manifestPath = path.join(outputDir, 'bootstrap-manifest.json');
      const auditPath = path.join(outputDir, 'bootstrap-audit.json');

      const manifest: BootstrapImportManifest = {
        runId: publicRunId,
        captureTimestamp: new Date().toISOString(),
        bootstrapStatus: isComplete ? 'COMPLETE' : 'INCOMPLETE',
        enabledCategories: categoriesManifest.map((c) => c.seedId),
        categories: categoriesManifest,
        pageTotals: {
          expected: pageExpected,
          generated: pageGenerated,
          processed: pageProcessed,
          missing: pageMissing,
        },
        productUrls: {
          extracted: discovery.extractedUrls.length,
          unique: deduped.uniqueUrls.length,
          duplicates: deduped.duplicateCount,
        },
        fetch: {
          successful: persistedSummary.successful,
          failed: persistedSummary.failed,
          skippedOrResumed: fetchPlan.skippedOrResumed,
          duplicateLogicalFetches: fetchPlan.duplicateLogicalFetches,
        },
        snapshots: {
          parsed: persistedSummary.parsedSnapshots,
          parseFailed: persistedSummary.parseFailedSnapshots,
          storageLocation: this.config.snapshotBaseDir,
          missingRequiredSnapshots,
        },
        deferredWork: [
          'M2-BUG-001 remains deferred: dynamic pagination bug path intentionally untouched.',
        ],
        m2Bug001Deferred: true,
        manifestPath,
        auditPath,
      };

      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      const audit = {
        ...manifest,
        silentSkips,
        failureReasons: {
          missingPages: pageMissing,
          silentSkips,
          duplicateLogicalFetches: fetchPlan.duplicateLogicalFetches,
          missingRequiredSnapshots,
        },
      };
      await writeFile(auditPath, JSON.stringify(audit, null, 2), 'utf-8');

      await this.config.runRepository.updateByRunId(publicRunId, {
        status: isComplete ? status : 'RUNNING',
        stage: 'FETCH',
        summary: {
          totalDiscovered: persistedSummary.uniqueUrls,
          totalFetched: persistedSummary.successful,
          totalFailed: persistedSummary.failed,
        },
        ...(isComplete && { completedAt: new Date() }),
      });

      return {
        runId: publicRunId,
        bootstrapStatus: manifest.bootstrapStatus,
        manifestPath,
        auditPath,
        manifest,
      };
    } finally {
      await this.config.workerLock.release(lockKey, lockOwner);
    }
  }

  private async getOrCreateRun(
    publicRunId: string,
    command: BootstrapImportCommand,
  ): Promise<ScrapeRunDocument> {
    const existing = await this.config.runRepository.findByRunId(publicRunId);
    if (existing) {
      if (
        existing.status === 'SUCCEEDED' ||
        existing.status === 'PARTIALLY_FAILED' ||
        existing.status === 'FAILED' ||
        existing.status === 'CANCELLED'
      ) {
        throw new Error(`Run ${publicRunId} is terminal and cannot be resumed`);
      }
      assertBootstrapResumeCompatibility(existing, command);
      return existing;
    }

    const created = await this.config.runRepository.create({
      runId: publicRunId,
      mode: command.seedId === undefined ? 'FULL' : 'CATEGORY',
      commandInput: JSON.stringify({
        mode: 'BOOTSTRAP_IMPORT',
        ...(command.seedId !== undefined && { seedId: command.seedId }),
      }),
    });

    await this.config.runRepository.updateByRunId(publicRunId, {
      status: 'RUNNING',
      stage: 'DISCOVERY',
      startedAt: new Date(),
    });

    return created;
  }

  private async discoverCategoryPages(
    publicRunId: string,
    command: BootstrapImportCommand,
  ): Promise<{ categories: CategoryProgress[]; extractedUrls: string[] }> {
    const seedRequests = this.config.adapter.getSeedRequests();
    const filteredSeeds = command.seedId
      ? seedRequests.filter((seed) => seed.userData.categoryHint === command.seedId)
      : seedRequests;

    if (filteredSeeds.length === 0) {
      throw new Error('No enabled category seeds found for bootstrap import');
    }

    const categories: CategoryProgress[] = [];
    const allExtractedUrls: string[] = [];

    for (const seed of filteredSeeds) {
      const seedId = seed.userData.categoryHint ?? 'all';
      const firstPageUrl = buildCategoryPageUrl(this.config.baseUrl, extractSeedSigmaId(seed.url));

      const first = await this.fetchPage(seed.url);
      const firstResult = await this.config.adapter.parseCategoryPage({
        url: seed.url,
        html: first.html,
        scrapeRunId: publicRunId,
        ...(seed.userData.categoryHint !== undefined && {
          categoryHint: seed.userData.categoryHint,
        }),
      });

      const expectedPages = calculateExpectedPages(firstResult.pagination.totalItems, 16);
      const generated = generateCategoryPageUrls(firstPageUrl, expectedPages);

      const progress: CategoryProgress = {
        seedId,
        categoryUrl: firstPageUrl,
        totalItems: firstResult.pagination.totalItems,
        expectedPages,
        generatedPageUrls: generated,
        processedPageUrls: new Set([generated[0] ?? firstPageUrl]),
        extractedUrls: firstResult.products.map((product) => product.canonicalUrl),
      };

      allExtractedUrls.push(...progress.extractedUrls);

      for (const pageUrl of generated.slice(1)) {
        try {
          const page = await this.fetchPage(pageUrl);
          const parsed = await this.config.adapter.parseCategoryPage({
            url: pageUrl,
            html: page.html,
            scrapeRunId: publicRunId,
            ...(seed.userData.categoryHint !== undefined && {
              categoryHint: seed.userData.categoryHint,
            }),
          });

          progress.processedPageUrls.add(pageUrl);
          const extracted = parsed.products.map((product) => product.canonicalUrl);
          progress.extractedUrls.push(...extracted);
          allExtractedUrls.push(...extracted);
        } catch {
          // Missing page is auditable in manifest via generated - processed.
        }
      }

      await this.config.runRepository.upsertCategoryAudit(publicRunId, {
        seedId: progress.seedId,
        pagesProcessed: progress.processedPageUrls.size,
        productsDiscovered: progress.extractedUrls.length,
        completed: progress.processedPageUrls.size === progress.generatedPageUrls.length,
      });

      categories.push(progress);
    }

    return {
      categories,
      extractedUrls: allExtractedUrls,
    };
  }

  private async fetchProducts(
    runId: Types.ObjectId,
    publicRunId: string,
    urls: string[],
  ): Promise<FetchOutcome> {
    let successful = 0;
    let failed = 0;
    let parsedSnapshots = 0;
    let parseFailedSnapshots = 0;

    for (const url of urls) {
      const item = await this.config.itemRepository.upsert({
        scrapeRunId: runId,
        canonicalUrl: url,
      });

      try {
        const response = await this.fetchPage(url);

        if (response.status !== 200) {
          const failureSnapshotId = await this.persistFailureSnapshot(
            runId,
            item.canonicalUrl,
            response.html,
            response.status,
            `HTTP_${response.status}`,
          );
          await this.config.itemRepository.updateByCanonicalUrl(runId, item.canonicalUrl, {
            fetchState: 'FAILED',
            attempts: item.attempts + 1,
            failureKind: this.config.adapter.classifyHttpFailure({ httpStatus: response.status }),
            ...(failureSnapshotId !== null && { snapshotId: failureSnapshotId }),
          });
          parseFailedSnapshots++;
          failed++;
          continue;
        }

        try {
          const parsed = await this.config.adapter.parseProductPage({
            url,
            html: response.html,
            scrapeRunId: publicRunId,
          });

          const writeResult = await this.config.snapshotStore.writeSnapshot({
            runId: runId.toString(),
            externalId: parsed.externalId,
            canonicalUrl: item.canonicalUrl,
            content: Buffer.from(response.html),
          });

          const existing = await this.config.snapshotRepository.findByContentSha256(
            writeResult.contentSha256,
            runId,
          );

          const snapshot =
            existing ??
            (await this.config.snapshotRepository.insert({
              storeCode: 'SIGMA',
              externalId: parsed.externalId,
              canonicalUrl: parsed.canonicalUrl,
              sourceUrl: parsed.sourceUrl,
              scrapeRunId: runId,
              fetchedAt: new Date(),
              httpStatus: parsed.httpStatus,
              responseContentType: parsed.responseContentType,
              contentSha256: writeResult.contentSha256,
              contentStorage: 'FILE',
              contentPath: writeResult.contentPath,
              parserVersion: this.config.adapter.parserVersion,
              parseStatus: parsed.raw.title !== null ? 'OK' : 'FAILED',
              raw: parsed.raw,
              parseWarnings: parsed.warnings,
            }));

          await this.config.itemRepository.updateByCanonicalUrl(runId, item.canonicalUrl, {
            fetchState: 'FETCHED',
            attempts: item.attempts + 1,
            snapshotId: snapshot._id,
          });

          await this.config.discoveredProductRepository.upsert({
            storeCode: 'SIGMA',
            canonicalUrl: item.canonicalUrl,
            scrapeRunId: runId,
            ...(parsed.externalId !== null && { externalId: parsed.externalId }),
          });

          parsedSnapshots++;
          successful++;
        } catch {
          const failureSnapshotId = await this.persistFailureSnapshot(
            runId,
            item.canonicalUrl,
            response.html,
            response.status,
            'PARSE_FAILED',
          );
          await this.config.itemRepository.updateByCanonicalUrl(runId, item.canonicalUrl, {
            fetchState: 'FAILED',
            attempts: item.attempts + 1,
            failureKind: 'PARSE_FAILED',
            ...(failureSnapshotId !== null && { snapshotId: failureSnapshotId }),
          });
          parseFailedSnapshots++;
          failed++;
        }
      } catch {
        await this.config.itemRepository.updateByCanonicalUrl(runId, item.canonicalUrl, {
          fetchState: 'FAILED',
          attempts: item.attempts + 1,
          failureKind: 'NETWORK',
        });
        failed++;
      }
    }

    return { successful, failed, parsedSnapshots, parseFailedSnapshots };
  }

  private async persistFailureSnapshot(
    runId: Types.ObjectId,
    canonicalUrl: string,
    html: string,
    httpStatus: number,
    warning: string,
  ): Promise<Types.ObjectId | null> {
    const writeResult = await this.config.snapshotStore.writeSnapshot({
      runId: runId.toString(),
      externalId: null,
      canonicalUrl,
      content: Buffer.from(html),
    });

    const existing = await this.config.snapshotRepository.findByContentSha256(
      writeResult.contentSha256,
      runId,
    );
    if (existing) {
      return existing._id;
    }

    const snapshot = await this.config.snapshotRepository.insert({
      storeCode: 'SIGMA',
      externalId: null,
      canonicalUrl,
      sourceUrl: canonicalUrl,
      scrapeRunId: runId,
      fetchedAt: new Date(),
      httpStatus,
      responseContentType: 'text/html',
      contentSha256: writeResult.contentSha256,
      contentStorage: 'FILE',
      contentPath: writeResult.contentPath,
      parserVersion: this.config.adapter.parserVersion,
      parseStatus: 'FAILED',
      raw: {
        title: null,
        priceText: null,
        oldPriceText: null,
        availabilityText: null,
        skuText: null,
        brandText: null,
        modelText: null,
        partNumberText: null,
        breadcrumbs: [],
        specifications: [],
        imageUrls: [],
        descriptionText: null,
      },
      parseWarnings: [`BOOTSTRAP_IMPORT_FAILURE: ${warning}`],
    });

    return snapshot._id;
  }

  private async fetchPage(url: string): Promise<{ status: number; html: string }> {
    const retries = this.config.maxRetries ?? 2;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      );

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': this.config.userAgent ?? DEFAULT_USER_AGENT,
            Accept: 'text/html',
            'Accept-Language': 'en',
          },
        });

        const html = await response.text();
        return { status: response.status, html };
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('Unreachable fetch retry state');
  }

  private async countMissingRequiredSnapshots(runId: Types.ObjectId): Promise<number> {
    const all = await this.config.itemRepository.findByRunId(runId);
    return all.filter(
      (item) =>
        item.attempts > 0 &&
        (item.fetchState === 'FETCHED' || item.fetchState === 'FAILED') &&
        item.snapshotId === undefined,
    ).length;
  }
}

function buildCategoryPageUrl(baseUrl: string, sigmaCategoryId: string): string {
  const url = new URL(`/en/category/${sigmaCategoryId}`, baseUrl);
  url.searchParams.delete('page');
  return url.href;
}

function extractSeedSigmaId(seedUrl: string): string {
  const url = new URL(seedUrl);
  const match = url.pathname.match(/\/en\/category\/([a-f0-9-]+)/i);
  if (!match?.[1]) {
    throw new Error(`Cannot extract Sigma category ID from seed URL: ${seedUrl}`);
  }
  return match[1];
}
