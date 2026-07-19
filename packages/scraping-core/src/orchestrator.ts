import { CheerioCrawler, Configuration } from 'crawlee';
import type {
  StoreScraperAdapter,
  CrawlerRequest,
  CategoryPageContext,
  ParsedRawProduct,
  ScrapeFailureKind,
} from '@buildsense/contracts';
import type {
  ScrapeRunRepository,
  ScrapeRunItemRepository,
  RawProductSnapshotRepository,
  DiscoveredProductRepository,
  WorkerLock,
  ScrapeRunItemDocument,
  CreateScrapeRunItemInput,
  CategoryAuditEntry,
} from '@buildsense/database';
import type { Types } from 'mongoose';
import type { SnapshotStore } from './snapshot-store.js';
import type { HealthGateResult } from './health-gates.js';
import { evaluateHealthGates, gateResultsToRecord } from './health-gates.js';
import { evaluateRobotsPolicy } from './robots-evaluator.js';
import * as crypto from 'node:crypto';

interface CrawlerLog {
  info: (message: string, data?: object) => void;
  warning: (message: string, data?: object) => void;
  error: (message: string, data?: object) => void;
}

export interface OrchestratorConfig {
  adapter: StoreScraperAdapter;
  snapshotStore: SnapshotStore;
  runRepository: ScrapeRunRepository;
  itemRepository: ScrapeRunItemRepository;
  snapshotRepository: RawProductSnapshotRepository;
  discoveredProductRepository: DiscoveredProductRepository;
  workerLock: WorkerLock;
  baseUrl: string;
  lockTtlMs?: number;
  maxPagesPerCategory?: number;
  maxRetries?: number;
  requestTimeoutMs?: number;
  requestsPerMinute?: number;
  maxConcurrency?: number;
  userAgent?: string;
  dryRun?: boolean;

  /**
   * Optional post-fetch publisher hook.  Called after a product snapshot is
   * persisted.  Used by the El Badr `import-url --publish` flow to write
   * CatalogProduct + Offer documents.  Default: no-op (not wired).
   */
  onProductPublished?: (event: ProductPublishedEvent) => Promise<void> | void;
}

/**
 * Event payload delivered to the optional `onProductPublished` hook.
 */
export interface ProductPublishedEvent {
  storeCode: string;
  externalId: string | null;
  canonicalUrl: string;
  sourceUrl: string;
  raw: ParsedRawProduct['raw'];
}

export interface RunCommand {
  mode: 'FULL' | 'CATEGORY' | 'URL';
  runId?: string;
  seedId?: string;
  url?: string;
  dryRun?: boolean;
}

export interface RunResult {
  runId: string;
  status: 'SUCCEEDED' | 'PARTIALLY_FAILED' | 'FAILED' | 'CANCELLED';
  summary: {
    totalDiscovered: number;
    totalFetched: number;
    totalFailed: number;
  };
  healthGates: HealthGateResult[];
}

const DEFAULT_USER_AGENT = 'BuildSense/0.1.0 (github.com/NourEldeenMahmoud/BuildSense)';
const DEFAULT_REQUEST_TIMEOUT_SEC = 15;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_REQUESTS_PER_MINUTE = 30;
const DEFAULT_MAX_CONCURRENCY = 3;

export class Orchestrator {
  private readonly config: OrchestratorConfig;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private seenFingerprints = new Map<string, Set<string>>();
  private categoryAudit = new Map<string, CategoryAuditEntry>();

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  private get storeCode() {
    return this.config.adapter.storeCode;
  }

  async executeRun(command: RunCommand): Promise<RunResult> {
    const publicRunId = command.runId ?? crypto.randomUUID();
    const shouldLock = !command.dryRun && command.mode !== 'URL';
    const lockOwner = `orchestrator-${publicRunId}`;
    const lockKey = `MUTATING_RUN:${this.storeCode}`;

    if (shouldLock) {
      const acquired = await this.config.workerLock.acquire({
        lockKey,
        owner: lockOwner,
        ttlMs: this.config.lockTtlMs ?? 300000,
      });
      if (!acquired) {
        throw new Error('Another mutating run is already in progress');
      }
    }

    try {
      const existingRun = await this.config.runRepository.findByRunId(publicRunId, this.storeCode);
      if (existingRun !== null && existingRun.status === 'RUNNING') {
        return this.resumeRun(existingRun, command);
      }

      const runDocument = await this.config.runRepository.create({
        storeCode: this.storeCode,
        runId: publicRunId,
        mode: command.mode,
        commandInput: JSON.stringify(command),
      });
      const runObjectId = runDocument._id;

      await this.config.runRepository.updateByRunId(publicRunId, {
        status: 'RUNNING',
        stage: 'DISCOVERY',
        startedAt: new Date(),
      }, this.storeCode);

      this.startHeartbeat(lockKey, lockOwner);

      // ADR-003: Fetch and evaluate robots.txt before FULL or CATEGORY runs
      if (command.mode === 'FULL' || command.mode === 'CATEGORY') {
        const robotsResult = await evaluateRobotsPolicy({
          baseUrl: this.config.baseUrl,
          userAgent: this.config.userAgent ?? DEFAULT_USER_AGENT,
        });

        await this.config.runRepository.updateByRunId(publicRunId, {
          robotsDecision: robotsResult.decision,
        }, this.storeCode);

        if (robotsResult.decision === 'DENIED') {
          await this.config.runRepository.updateByRunId(publicRunId, {
            status: 'FAILED',
            completedAt: new Date(),
          }, this.storeCode);
          return {
            runId: publicRunId,
            status: 'FAILED',
            summary: { totalDiscovered: 0, totalFetched: 0, totalFailed: 0 },
            healthGates: [],
          };
        }
      }

      if (command.mode === 'URL') {
        await this.executeUrlRun(runObjectId, publicRunId, command);
      } else {
        await this.executeDiscoveryPhase(runObjectId, publicRunId, command);
      }

      return this.finalizeRun(publicRunId, command.mode);
    } catch (error) {
      await this.config.runRepository.updateByRunId(publicRunId, {
        status: 'FAILED',
        completedAt: new Date(),
      }, this.storeCode);
      throw error;
    } finally {
      this.stopHeartbeat();
      if (shouldLock) {
        await this.config.workerLock.release(lockKey, lockOwner);
      }
    }
  }

  private async executeUrlRun(
    runObjectId: Types.ObjectId,
    publicRunId: string,
    command: RunCommand,
  ): Promise<void> {
    if (!command.url) throw new Error('url required for URL mode');

    await this.config.runRepository.updateByRunId(publicRunId, {
      stage: 'FETCH',
    }, this.storeCode);

    const requests: CrawlerRequest[] = [{
      url: command.url,
      userData: {
        label: 'PRODUCT_PAGE',
        scrapeRunId: publicRunId,
      },
    }];

    const crawler = this.createProductCrawler(runObjectId, publicRunId);
    await crawler.run(requests);
  }

  private async executeDiscoveryPhase(
    runObjectId: Types.ObjectId,
    publicRunId: string,
    command: RunCommand,
  ): Promise<void> {
    const discoveryRequests = this.buildDiscoveryRequests(command, publicRunId);
    const discoveryCrawler = this.createDiscoveryCrawler(runObjectId, publicRunId);
    await discoveryCrawler.run(discoveryRequests);

    await this.config.runRepository.updateByRunId(publicRunId, {
      stage: 'FETCH',
    }, this.storeCode);

    const pendingItems = await this.config.itemRepository.findPendingByRunId(runObjectId);
    if (pendingItems.length === 0) return;

    const fetchRequests: CrawlerRequest[] = pendingItems.map((item) => ({
      url: item.canonicalUrl,
      userData: {
        label: 'PRODUCT_PAGE' as const,
        scrapeRunId: publicRunId,
        ...(item.categorySeedId !== undefined && { categoryHint: item.categorySeedId }),
      },
    }));

    const fetchCrawler = this.createProductCrawler(runObjectId, publicRunId);
    await fetchCrawler.run(fetchRequests);
  }

  private createDiscoveryCrawler(
    runObjectId: Types.ObjectId,
    publicRunId: string,
  ): CheerioCrawler {
    const timeoutSec = this.config.requestTimeoutMs
      ? Math.ceil(this.config.requestTimeoutMs / 1000)
      : DEFAULT_REQUEST_TIMEOUT_SEC;

    Configuration.getGlobalConfig().set('persistStorage', false);

    const baseUrlHost = new URL(this.config.baseUrl).hostname;

    return new CheerioCrawler({
      maxRequestsPerMinute: this.config.requestsPerMinute ?? DEFAULT_REQUESTS_PER_MINUTE,
      maxConcurrency: this.config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      minConcurrency: 1,
      requestHandlerTimeoutSecs: timeoutSec,
      maxRequestRetries: this.config.maxRetries ?? DEFAULT_MAX_RETRIES,
      ignoreHttpErrorStatusCodes: [404, 401, 403, 410],
      additionalHttpErrorStatusCodes: [429],
      useSessionPool: false,

      preNavigationHooks: [
        (_crawlingContext, gotOptions) => {
          gotOptions.headers = {
            ...gotOptions.headers,
            'User-Agent': this.config.userAgent ?? DEFAULT_USER_AGENT,
            'Accept': 'text/html',
            'Accept-Language': 'en',
          };
        },
        (crawlingContext) => {
          // Same-domain enforcement: reject off-domain URLs before navigation
          const requestHost = new URL(crawlingContext.request.url).hostname;
          if (requestHost !== baseUrlHost) {
            crawlingContext.request.noRetry = true;
            throw new Error(`Off-domain redirect rejected: ${requestHost} (expected: ${baseUrlHost})`);
          }
        },
      ],

      requestHandler: async ({ request, body, response, log, addRequests }) => {
        const userData = request.userData as {
          label: string;
          scrapeRunId: string;
          categoryHint?: string;
          pageNumber?: number;
          discoverySourceUrl?: string;
        };
        const html = String(body);

        const nextPageRequests = await this.handleCategoryPage(
          runObjectId,
          publicRunId,
          request.url,
          html,
          response.statusCode ?? 0,
          userData.categoryHint,
          userData.pageNumber ?? 1,
          userData.discoverySourceUrl ?? request.url,
          log,
        );

        if (nextPageRequests.length > 0) {
          await addRequests(nextPageRequests);
        }
      },

      failedRequestHandler: async ({ request, log }, error) => {
        const userData = request.userData as {
          label: string;
          scrapeRunId: string;
          categoryHint?: string;
        };

        log.error(`Category request failed after retries: ${request.url}`, {
          errorMessage: error.message,
          retryCount: request.retryCount,
        });

        const failureKind = this.classifyFailure(error, undefined);
        await this.recordCategoryFailure(
          publicRunId,
          userData.categoryHint,
          failureKind,
        );
      },
    });
  }

  private createProductCrawler(
    runObjectId: Types.ObjectId,
    publicRunId: string,
  ): CheerioCrawler {
    const timeoutSec = this.config.requestTimeoutMs
      ? Math.ceil(this.config.requestTimeoutMs / 1000)
      : DEFAULT_REQUEST_TIMEOUT_SEC;

    Configuration.getGlobalConfig().set('persistStorage', false);

    const baseUrlHost = new URL(this.config.baseUrl).hostname;

    return new CheerioCrawler({
      maxRequestsPerMinute: this.config.requestsPerMinute ?? DEFAULT_REQUESTS_PER_MINUTE,
      maxConcurrency: this.config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      minConcurrency: 1,
      requestHandlerTimeoutSecs: timeoutSec,
      maxRequestRetries: this.config.maxRetries ?? DEFAULT_MAX_RETRIES,
      ignoreHttpErrorStatusCodes: [404, 401, 403, 410],
      additionalHttpErrorStatusCodes: [429],
      useSessionPool: false,

      preNavigationHooks: [
        (_crawlingContext, gotOptions) => {
          gotOptions.headers = {
            ...gotOptions.headers,
            'User-Agent': this.config.userAgent ?? DEFAULT_USER_AGENT,
            'Accept': 'text/html',
            'Accept-Language': 'en',
          };
        },
        (crawlingContext) => {
          // Same-domain enforcement: reject off-domain URLs before navigation
          const requestHost = new URL(crawlingContext.request.url).hostname;
          if (requestHost !== baseUrlHost) {
            crawlingContext.request.noRetry = true;
            throw new Error(`Off-domain redirect rejected: ${requestHost} (expected: ${baseUrlHost})`);
          }
        },
      ],

      requestHandler: async ({ request, body, response, log }) => {
        const userData = request.userData as {
          label: string;
          scrapeRunId: string;
          categoryHint?: string;
        };
        const html = String(body);

        await this.handleProductPage(
          runObjectId,
          publicRunId,
          request.url,
          html,
          response.statusCode ?? 0,
          userData.categoryHint,
          log,
        );
      },

      failedRequestHandler: async ({ request, log }, error) => {
        const userData = request.userData as {
          label: string;
          scrapeRunId: string;
          categoryHint?: string;
        };

        log.error(`Product request failed after retries: ${request.url}`, {
          errorMessage: error.message,
          retryCount: request.retryCount,
        });

        const failureKind = this.classifyFailure(error, undefined);
        await this.persistProductFailure(
          runObjectId,
          request.url,
          userData.categoryHint,
          failureKind,
        );
      },
    });
  }

  private async handleCategoryPage(
    runObjectId: Types.ObjectId,
    publicRunId: string,
    url: string,
    html: string,
    httpStatus: number,
    categoryHint: string | undefined,
    pageNumber: number,
    discoverySourceUrl: string,
    log: CrawlerLog,
  ): Promise<CrawlerRequest[]> {
    const seedId = categoryHint ?? 'all';

    if (httpStatus !== 200) {
      const failureKind = this.config.adapter.classifyHttpFailure({ httpStatus });
      await this.recordCategoryFailure(publicRunId, categoryHint, failureKind);
      return [];
    }

    try {
      const context: CategoryPageContext = {
        url,
        html,
        scrapeRunId: publicRunId,
        ...(categoryHint !== undefined && { categoryHint }),
      };
      const result = await this.config.adapter.parseCategoryPage(context);

      const fingerprint = this.computePageFingerprint(result.products.map((p) => p.canonicalUrl));
      const fingerprintKey = `${publicRunId}:${seedId}`;
      let fingerprints = this.seenFingerprints.get(fingerprintKey);
      if (!fingerprints) {
        fingerprints = new Set();
        this.seenFingerprints.set(fingerprintKey, fingerprints);
      }

      if (fingerprints.has(fingerprint)) {
        log.info(`Pagination loop detected, stopping category: ${seedId} page ${pageNumber}`);
        await this.recordCategoryFailure(publicRunId, categoryHint, 'PAGINATION_LOOP');
        return [];
      }
      fingerprints.add(fingerprint);

      const maxPages = this.config.maxPagesPerCategory ?? 200;
      let audit = this.categoryAudit.get(seedId);
      if (!audit) {
        audit = { seedId, pagesProcessed: 0, productsDiscovered: 0, completed: false };
        this.categoryAudit.set(seedId, audit);
      }

      for (const product of result.products) {
        const itemInput: CreateScrapeRunItemInput = {
          scrapeRunId: runObjectId,
          canonicalUrl: product.canonicalUrl,
          discoverySourceUrl,
          ...(categoryHint !== undefined && { categorySeedId: categoryHint }),
        };
        await this.config.itemRepository.upsert(itemInput);

        if (!this.config.dryRun) {
          const discoveredInput: import('@buildsense/database').UpsertDiscoveredProductInput = {
            storeCode: this.config.adapter.storeCode,
            canonicalUrl: product.canonicalUrl,
            scrapeRunId: runObjectId,
          };
          if (product.externalId != null) {
            discoveredInput.externalId = product.externalId;
          }
          await this.config.discoveredProductRepository.upsert(discoveredInput);
        }

        audit.productsDiscovered++;
      }

      audit.pagesProcessed++;

      const nextPageRequests: CrawlerRequest[] = [];

      if (result.pagination.isNext && pageNumber < maxPages) {
        const pageUrl = new URL(url);
        pageUrl.searchParams.set('page', String(pageNumber + 1));
        log.info(`Enqueuing next category page: ${pageUrl.href} (${seedId})`);

        nextPageRequests.push({
          url: pageUrl.href,
          userData: {
            label: 'CATEGORY_PAGE',
            pageNumber: pageNumber + 1,
            scrapeRunId: publicRunId,
            discoverySourceUrl,
            ...(categoryHint !== undefined && { categoryHint }),
          },
        });
      } else if (!result.pagination.isNext) {
        audit.completed = true;
      } else {
        log.warning(`Page limit reached: ${seedId} at page ${pageNumber}`);
        audit.failureKind = 'PAGE_LIMIT_EXCEEDED';
      }

      await this.config.runRepository.upsertCategoryAudit(publicRunId, audit, this.storeCode);

      log.info(`Category page processed: ${seedId} page=${pageNumber} products=${result.products.length} hasNext=${result.pagination.isNext}`);

      return nextPageRequests;
    } catch (error) {
      const failureKind = this.classifyFailure(error, undefined);
      await this.recordCategoryFailure(publicRunId, categoryHint, failureKind);
      return [];
    }
  }

  private async handleProductPage(
    runObjectId: Types.ObjectId,
    publicRunId: string,
    url: string,
    html: string,
    httpStatus: number,
    categoryHint: string | undefined,
    log: CrawlerLog,
  ): Promise<void> {
    const item = await this.config.itemRepository.upsert({
      scrapeRunId: runObjectId,
      canonicalUrl: url,
      ...(categoryHint !== undefined && { categorySeedId: categoryHint }),
    });

    if (item.fetchState === 'FETCHED') {
      return;
    }

    if (httpStatus !== 200) {
      const failureKind = this.config.adapter.classifyHttpFailure({ httpStatus });
      await this.persistProductFailure(runObjectId, url, categoryHint, failureKind);
      return;
    }

    try {
      const result = await this.config.adapter.parseProductPage({
        url,
        html,
        scrapeRunId: publicRunId,
      });

      if (!this.config.dryRun) {
        await this.persistSnapshot(runObjectId, item, result, Buffer.from(html));
        const discoveredInput: import('@buildsense/database').UpsertDiscoveredProductInput = {
          storeCode: this.config.adapter.storeCode,
          canonicalUrl: url,
          scrapeRunId: runObjectId,
        };
        if (result.externalId != null) {
          discoveredInput.externalId = result.externalId;
        }
        await this.config.discoveredProductRepository.upsert(discoveredInput);
      }

      await this.config.itemRepository.updateByCanonicalUrl(runObjectId, url, {
        fetchState: 'FETCHED',
        attempts: item.attempts + 1,
      });

      log.info(`Product fetched: ${url} externalId=${result.externalId}`);

      // Optional publisher hook (El Badr import-url --publish flow)
      if (this.config.onProductPublished) {
        try {
          await this.config.onProductPublished({
            storeCode: this.config.adapter.storeCode,
            externalId: result.externalId,
            canonicalUrl: result.canonicalUrl,
            sourceUrl: result.sourceUrl,
            raw: result.raw,
          });
        } catch (hookError) {
          log.warning(`Publisher hook failed: ${hookError instanceof Error ? hookError.message : String(hookError)}`);
          // Re-throw so callers can observe hook failures
          throw hookError;
        }
      }
    } catch (error) {
      const failureKind = this.classifyFailure(error, undefined);

      if (!this.config.dryRun) {
        await this.persistFailureSnapshot(runObjectId, url, html, httpStatus, failureKind);
      }

      await this.config.itemRepository.updateByCanonicalUrl(runObjectId, url, {
        fetchState: 'FAILED',
        attempts: item.attempts + 1,
        failureKind,
      });

      log.warning(`Product fetch failed: ${url} failureKind=${failureKind}`);
    }
  }

  private async recordCategoryFailure(
    publicRunId: string,
    categoryHint: string | undefined,
    failureKind: ScrapeFailureKind,
  ): Promise<void> {
    const seedId = categoryHint ?? 'all';
    let audit = this.categoryAudit.get(seedId);
    if (!audit) {
      audit = { seedId, pagesProcessed: 0, productsDiscovered: 0, completed: false };
      this.categoryAudit.set(seedId, audit);
    }
    audit.failureKind = failureKind;
    await this.config.runRepository.upsertCategoryAudit(publicRunId, audit, this.storeCode);
  }

  private async persistProductFailure(
    runObjectId: Types.ObjectId,
    url: string,
    categoryHint: string | undefined,
    failureKind: ScrapeFailureKind,
  ): Promise<void> {
    const item = await this.config.itemRepository.upsert({
      scrapeRunId: runObjectId,
      canonicalUrl: url,
      ...(categoryHint !== undefined && { categorySeedId: categoryHint }),
    });

    await this.config.itemRepository.updateByCanonicalUrl(runObjectId, url, {
      fetchState: 'FAILED',
      attempts: item.attempts + 1,
      failureKind,
    });
  }

  private buildDiscoveryRequests(command: RunCommand, publicRunId: string): CrawlerRequest[] {
    switch (command.mode) {
      case 'FULL':
        return this.config.adapter.getSeedRequests().map((req) => ({
          ...req,
          userData: { ...req.userData, scrapeRunId: publicRunId },
        }));
      case 'CATEGORY': {
        if (!command.seedId) throw new Error('seedId required for CATEGORY mode');
        const seedReqs = this.config.adapter.getSeedRequests();
        return seedReqs
          .filter((req: CrawlerRequest) => req.userData.categoryHint === command.seedId)
          .map((req: CrawlerRequest) => ({
            ...req,
            userData: { ...req.userData, scrapeRunId: publicRunId },
          }));
      }
      case 'URL': {
        throw new Error('URL mode should use executeUrlRun');
      }
    }
  }

  private async resumeRun(
    existingRun: import('@buildsense/database').ScrapeRunDocument,
    command: RunCommand,
  ): Promise<RunResult> {
    if (existingRun.mode !== command.mode) {
      throw new Error(
        `Cannot resume run ${existingRun.runId}: mode mismatch (existing=${existingRun.mode}, requested=${command.mode})`,
      );
    }

    const publicRunId = existingRun.runId;
    const runObjectId = existingRun._id;
    const pendingItems = await this.config.itemRepository.findPendingByRunId(runObjectId);

    if (pendingItems.length === 0) {
      return this.finalizeRun(publicRunId, command.mode);
    }

    await this.config.runRepository.updateByRunId(publicRunId, {
      stage: 'FETCH',
    }, this.storeCode);

    const productRequests: CrawlerRequest[] = pendingItems.map((item) => ({
      url: item.canonicalUrl,
      userData: {
        label: 'PRODUCT_PAGE' as const,
        scrapeRunId: publicRunId,
        ...(item.categorySeedId !== undefined && { categoryHint: item.categorySeedId }),
      },
    }));

    const crawler = this.createProductCrawler(runObjectId, publicRunId);
    await crawler.run(productRequests);

    return this.finalizeRun(publicRunId, command.mode);
  }

  private async finalizeRun(
    publicRunId: string,
    mode: 'FULL' | 'CATEGORY' | 'URL',
  ): Promise<RunResult> {
    const run = await this.config.runRepository.findByRunId(publicRunId, this.storeCode);
    if (!run) throw new Error(`Run ${publicRunId} not found`);

    const allItems = await this.config.itemRepository.findByRunId(run._id);

    const summary = {
      totalDiscovered: allItems.length,
      totalFetched: allItems.filter((i) => i.fetchState === 'FETCHED').length,
      totalFailed: allItems.filter((i) => i.fetchState === 'FAILED').length,
    };

    // Compute missing price count for persistence
    const missingPriceCounts = await this.config.snapshotRepository.countMissingPricesByRunId(run._id);

    const healthGates = await this.evaluateGates(mode, summary, allItems, run._id, run.categoryAudit);
    const status = this.determineStatus(summary, healthGates, run.categoryAudit);

    // M2-BUG-001: Warn when category audits are incomplete (first-page/sample only).
    // This is a structured warning, not a CLI mode change. The persisted category
    // audit remains completed=false unless a terminal page was actually processed.
    if ((mode === 'FULL' || mode === 'CATEGORY') && run.categoryAudit && run.categoryAudit.length > 0) {
      const incompleteCategories = run.categoryAudit.filter((a) => !a.completed);
      if (incompleteCategories.length > 0) {
        const incompleteSeedIds = incompleteCategories.map((a) => a.seedId);
        console.warn(JSON.stringify({
          event: 'PAGINATION_INCOMPLETE',
          bugRef: 'M2-BUG-001',
          runId: publicRunId,
          mode,
          incompleteCategories: incompleteSeedIds,
          message: `Run completed with first-page/sample behavior. Pagination not fully executed for categories: ${incompleteSeedIds.join(', ')}. Full pagination is required before M3.`,
        }));
      }
    }

    await this.config.runRepository.updateByRunId(publicRunId, {
      status,
      stage: 'FETCH',
      summary: {
        ...summary,
        totalMissingPrice: missingPriceCounts.missing,
      },
      healthGates: gateResultsToRecord(healthGates),
      completedAt: new Date(),
    }, this.storeCode);

    return { runId: publicRunId, status, summary, healthGates };
  }

  private computePageFingerprint(sortedUrls: string[]): string {
    const sorted = [...sortedUrls].sort();
    return crypto.createHash('sha256').update(sorted.join('\n')).digest('hex');
  }

  private classifyFailure(error: unknown, httpStatus?: number): ScrapeFailureKind {
    if (httpStatus !== undefined) {
      return this.config.adapter.classifyHttpFailure({ httpStatus });
    }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('off-domain redirect rejected')) {
        return 'OFF_DOMAIN_REDIRECT';
      }
      if (msg.includes('timeout') || msg.includes('abort') || msg.includes('timed out')) {
        return 'TIMEOUT';
      }
      if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('network')) {
        return 'NETWORK';
      }
      if (msg.includes('parse_failed')) return 'PARSE_FAILED';
    }

    return 'PARSE_FAILED';
  }

  private async persistSnapshot(
    runObjectId: Types.ObjectId,
    item: ScrapeRunItemDocument,
    result: ParsedRawProduct,
    content: Buffer,
  ): Promise<void> {
    const writeResult = await this.config.snapshotStore.writeSnapshot({
      runId: runObjectId.toString(),
      externalId: result.externalId,
      canonicalUrl: item.canonicalUrl,
      content,
    });

    const existing = await this.config.snapshotRepository.findByContentSha256(
      writeResult.contentSha256,
      runObjectId,
    );
    if (existing) {
      await this.config.itemRepository.updateByCanonicalUrl(runObjectId, item.canonicalUrl, {
        snapshotId: existing._id,
      });
      return;
    }

    const snapshot = await this.config.snapshotRepository.insert({
      storeCode: this.config.adapter.storeCode,
      externalId: result.externalId,
      canonicalUrl: result.canonicalUrl,
      sourceUrl: result.sourceUrl,
      scrapeRunId: runObjectId,
      fetchedAt: new Date(),
      httpStatus: result.httpStatus,
      responseContentType: result.responseContentType,
      contentSha256: writeResult.contentSha256,
      contentStorage: 'FILE',
      contentPath: writeResult.contentPath,
      parserVersion: this.config.adapter.parserVersion,
      parseStatus: result.raw.title !== null ? 'OK' : 'FAILED',
      raw: result.raw,
      parseWarnings: result.warnings,
    });

    await this.config.itemRepository.updateByCanonicalUrl(runObjectId, item.canonicalUrl, {
      snapshotId: snapshot._id,
    });
  }

  private async persistFailureSnapshot(
    runObjectId: Types.ObjectId,
    canonicalUrl: string,
    html: string,
    httpStatus: number,
    failureKind: ScrapeFailureKind,
  ): Promise<void> {
    try {
      const content = Buffer.from(html);
      const writeResult = await this.config.snapshotStore.writeSnapshot({
        runId: runObjectId.toString(),
        externalId: null,
        canonicalUrl,
        content,
      });

      const existing = await this.config.snapshotRepository.findByContentSha256(
        writeResult.contentSha256,
        runObjectId,
      );
      if (existing) return;

      await this.config.snapshotRepository.insert({
        storeCode: this.config.adapter.storeCode,
        externalId: null,
        canonicalUrl,
        sourceUrl: canonicalUrl,
        scrapeRunId: runObjectId,
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
        parseWarnings: [`FAILURE_SNAPSHOT: ${failureKind}`],
      });
    } catch {
      // Failure snapshot persistence is best-effort
    }
  }

  private async evaluateGates(
    mode: 'FULL' | 'CATEGORY' | 'URL',
    summary: { totalDiscovered: number; totalFetched: number; totalFailed: number },
    items: ScrapeRunItemDocument[],
    runObjectId: Types.ObjectId,
    currentCategoryAudit?: CategoryAuditEntry[],
  ): Promise<HealthGateResult[]> {
    if (mode !== 'FULL') {
      return [];
    }

    let baseline: { totalDiscovered: number; categoryAudit?: CategoryAuditEntry[]; totalMissingPrice?: number } | undefined;
    const latestSuccessful = await this.config.runRepository.findLatestSuccessful(this.storeCode);
    if (latestSuccessful !== null && latestSuccessful.summary !== undefined) {
      baseline = {
        totalDiscovered: latestSuccessful.summary.totalDiscovered,
        ...(latestSuccessful.categoryAudit !== undefined && { categoryAudit: latestSuccessful.categoryAudit }),
        ...(latestSuccessful.summary.totalMissingPrice !== undefined && { totalMissingPrice: latestSuccessful.summary.totalMissingPrice }),
      };
    }

    // Compute current missing prices from OK snapshots
    const currentMissingPrice = await this.config.snapshotRepository.countMissingPricesByRunId(runObjectId);

    return evaluateHealthGates({
      items,
      totalDiscovered: summary.totalDiscovered,
      baseline,
      currentCategoryAudit,
      currentMissingPrice,
    });
  }

  private determineStatus(
    summary: { totalDiscovered: number; totalFetched: number; totalFailed: number },
    healthGates: HealthGateResult[],
    categoryAudit?: CategoryAuditEntry[],
  ): 'SUCCEEDED' | 'PARTIALLY_FAILED' | 'FAILED' {
    if (summary.totalDiscovered === 0) return 'FAILED';

    // TDD §8.8 / ADR-003 Partial vs Full Success:
    // SUCCEEDED only when all required stages completed with no terminal failures.
    // Category audit tracks discovery-stage completeness per seed.
    // Check categoryAudit before totalFetched so that discovery-stage terminal
    // failures or incompleteness influence the status even when fetch stage
    // produced zero successful fetches (e.g. dry-run or total fetch failure).
    if (categoryAudit && categoryAudit.length > 0) {
      const hasTerminalCategoryFailure = categoryAudit.some((a) => a.failureKind !== undefined);
      const allCategoriesCompleted = categoryAudit.every((a) => a.completed);

      if (hasTerminalCategoryFailure || !allCategoriesCompleted) {
        // Discovery stage had terminal failures or did not complete for all categories.
        // ADR-003: "FAILED: a critical stage (discovery/fetch) cannot proceed."
        // If useful products were discovered, this is PARTIALLY_FAILED rather than FAILED.
        if (summary.totalDiscovered > 0) return 'PARTIALLY_FAILED';
        return 'FAILED';
      }
    }

    if (summary.totalFetched === 0) return 'FAILED';

    const hasFailedGate = healthGates.some((g) => !g.passed && g.severity === 'FAILED');
    if (hasFailedGate) return 'FAILED';

    const hasPartiallyFailedGate = healthGates.some((g) => !g.passed && g.severity === 'PARTIALLY_FAILED');
    if (hasPartiallyFailedGate) return 'PARTIALLY_FAILED';

    if (summary.totalFailed === 0) return 'SUCCEEDED';
    if (summary.totalFailed < summary.totalDiscovered) return 'PARTIALLY_FAILED';
    return 'FAILED';
  }

  private startHeartbeat(lockKey: string, owner: string): void {
    this.heartbeatInterval = setInterval(() => {
      void this.config.workerLock.heartbeat(
        lockKey,
        owner,
        this.config.lockTtlMs ?? 300000,
      );
    }, 60000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
