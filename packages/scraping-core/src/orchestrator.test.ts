import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import { GotScrapingHttpClient } from '@crawlee/core';
import { Types } from 'mongoose';
import { Configuration } from 'crawlee';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '@buildsense/database/src/test-utils.js';
import {
  ScrapeRunRepository,
  ScrapeRunItemRepository,
  RawProductSnapshotRepository,
  DiscoveredProductRepository,
} from '@buildsense/database';
import { Orchestrator } from './orchestrator.js';
import type { OrchestratorConfig } from './orchestrator.js';
import type {
  StoreScraperAdapter,
  CrawlerRequest,
  CategoryPageContext,
  CategoryParseResult,
  ParsedRawProduct,
} from '@buildsense/contracts';

// ─── HTTP mock helpers ──────────────────────────────────────────────────────────
// Instead of trying to mock the deep got-scraping → @crawlee/utils → @crawlee/core
// chain (which uses lazy dynamic imports that vi.mock can't intercept), we spy
// directly on GotScrapingHttpClient.prototype.stream — the exact method Crawlee calls.

function createMockStreamResponse(html: string, requestUrl: string, statusCode = 200) {
  const stream = Readable.from(Buffer.from(html));
  // Add properties that Crawlee's addResponsePropertiesToStream copies onto the stream
  Object.assign(stream, {
    statusCode,
    statusMessage: 'OK',
    headers: { 'content-type': 'text/html; charset=utf-8' },
    rawHeaders: [],
    complete: true,
    httpVersion: '1.1',
    url: requestUrl,
    request: { url: requestUrl },
    redirectUrls: [],
    trailers: {},
    rawTrailers: [],
  });
  // Return the shape GotScrapingHttpClient.stream() produces:
  // { stream, statusCode, headers, downloadProgress, uploadProgress, ... }
  // HttpCrawler copies statusCode/headers/etc onto the stream via addResponsePropertiesToStream.
  return {
    stream,
    statusCode,
    statusMessage: 'OK',
    headers: { 'content-type': 'text/html; charset=utf-8' },
    rawHeaders: [],
    complete: true,
    httpVersion: '1.1',
    url: requestUrl,
    request: { url: requestUrl },
    redirectUrls: [],
    trailers: {},
    rawTrailers: [],
    downloadProgress: { percent: 1, transferred: 0, total: 0 },
    uploadProgress: { percent: 1, transferred: 0, total: 0 },
  };
}

// Persistent spy on GotScrapingHttpClient.prototype.stream.
// Each test sets its own implementation via mockImplementation in beforeEach.
const streamSpy = vi.spyOn(GotScrapingHttpClient.prototype, 'stream');

// Default implementation: return valid HTML for any URL so tests that don't
// explicitly install an HTTP mock (e.g. the URL-mode linkage tests) still work.
streamSpy.mockImplementation(async (request: Record<string, unknown>) => {
  const url = String(request?.url ?? '');
  return createMockStreamResponse('<html><body>product</body></html>', url);
});

function installHttpMock(responseForUrl?: (url: string) => string | null) {
  streamSpy.mockImplementation(async (request: Record<string, unknown>) => {
    const url = String(request?.url ?? '');
    const html = responseForUrl?.(url) ?? '<html></html>';
    return createMockStreamResponse(html, url);
  });
}

function resetHttpMock() {
  // mockReset clears the implementation but keeps the spy attached to the prototype.
  // mockRestore() would detach the spy entirely, making subsequent mockImplementation() no-ops.
  streamSpy.mockReset();
}

function createMockAdapter(overrides: Partial<StoreScraperAdapter> = {}): StoreScraperAdapter {
  return {
    storeCode: 'SIGMA',
    parserVersion: '0.1.0',
    getSeedRequests: (): CrawlerRequest[] => [],
    parseCategoryPage: async (_ctx: CategoryPageContext): Promise<CategoryParseResult> => ({
      products: [],
      pagination: { totalItems: 0, perPage: 20, isNext: false, isPrevious: false },
    }),
    parseProductPage: async (): Promise<ParsedRawProduct> => ({
      externalId: null,
      canonicalUrl: 'https://example.com',
      sourceUrl: 'https://example.com',
      httpStatus: 200,
      responseContentType: 'text/html',
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
      warnings: [],
    }),
    extractExternalId: () => null,
    classifyHttpFailure: () => 'HTTP_5XX',
    ...overrides,
  };
}

function createMockSnapshotStore() {
  return {
    writeSnapshot: async () => ({
      contentPath: '/tmp/test.html',
      contentSha256: 'abc123',
      bytesWritten: 100,
      wasDuplicate: false,
    }),
    readSnapshot: async () => null,
    snapshotExists: async () => false,
    getSnapshotPath: () => '/tmp/test.html',
  };
}

function createMockWorkerLock() {
  const locks = new Map<string, string>();
  return {
    acquire: async (input: { lockKey: string; owner: string; ttlMs: number }) => {
      if (locks.has(input.lockKey)) return false;
      locks.set(input.lockKey, input.owner);
      return true;
    },
    release: async (lockKey: string) => {
      locks.delete(lockKey);
      return true;
    },
    heartbeat: async () => true,
    isHeld: async (lockKey: string) => locks.has(lockKey),
    getOwner: async (lockKey: string) => locks.get(lockKey) ?? null,
  };
}

describe('Orchestrator run ID linkage', () => {
  let runRepository: ScrapeRunRepository;
  let itemRepository: ScrapeRunItemRepository;
  let snapshotRepository: RawProductSnapshotRepository;
  let discoveredProductRepository: DiscoveredProductRepository;
  const originalStorageClient = Configuration.getGlobalConfig().getStorageClient();

  beforeAll(async () => {
    await connectInMemoryDatabase();
    runRepository = new ScrapeRunRepository();
    itemRepository = new ScrapeRunItemRepository();
    snapshotRepository = new RawProductSnapshotRepository();
    discoveredProductRepository = new DiscoveredProductRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    // Isolate Crawlee request queue per test to prevent cross-test state pollution
    Configuration.getGlobalConfig().set('persistStorage', false);
    Configuration.getGlobalConfig().set('defaultRequestQueueId', `test-rq-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    Configuration.getGlobalConfig().useStorageClient(originalStorageClient);
  });

  function createOrchestrator(overrides: Partial<OrchestratorConfig> = {}): Orchestrator {
    return new Orchestrator({
      adapter: createMockAdapter(),
      snapshotStore: createMockSnapshotStore() as unknown as OrchestratorConfig['snapshotStore'],
      runRepository,
      itemRepository,
      snapshotRepository,
      discoveredProductRepository,
      workerLock: createMockWorkerLock() as OrchestratorConfig['workerLock'],
      baseUrl: 'https://www.sigma-computer.com',
      dryRun: true,
      ...overrides,
    });
  }

  it('uses run document _id for items, not the public UUID', async () => {
    const publicRunId = '550e8400-e29b-41d4-a716-446655440000';

    const orchestrator = createOrchestrator();
    await orchestrator.executeRun({
      mode: 'URL',
      runId: publicRunId,
      url: 'https://www.sigma-computer.com/en/product/test',
    });

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run).toBeDefined();
    expect(run!._id).toBeInstanceOf(Types.ObjectId);

    const items = await itemRepository.findByRunId(run!._id);
    expect(items.length).toBe(1);
    expect(items[0]!.scrapeRunId.toString()).toBe(run!._id.toString());
  });

  it('UUID runId does not crash with ObjectId conversion', async () => {
    const publicRunId = '660e8400-e29b-41d4-a716-446655440001';

    const orchestrator = createOrchestrator();
    await expect(
      orchestrator.executeRun({
        mode: 'URL',
        runId: publicRunId,
        url: 'https://www.sigma-computer.com/en/product/test',
      }),
    ).resolves.toBeDefined();
  });

  it('generates a UUID when no runId is provided', async () => {
    const orchestrator = createOrchestrator();
    const result = await orchestrator.executeRun({
      mode: 'URL',
      url: 'https://www.sigma-computer.com/en/product/test',
    });

    expect(result.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('category failures record to categoryAudit, not as product items', async () => {
    const publicRunId = '770e8400-e29b-41d4-a716-446655440002';

    const failingAdapter = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/gpu',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'gpu', scrapeRunId: publicRunId },
      }],
      parseCategoryPage: async () => {
        throw new Error('parse_failed');
      },
    });

    const orchestrator = createOrchestrator({ adapter: failingAdapter, dryRun: false });
    await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'gpu',
      runId: publicRunId,
    });

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run).toBeDefined();

    const items = await itemRepository.findByRunId(run!._id);
    expect(items).toHaveLength(0);

    expect(run!.categoryAudit).toBeDefined();
    expect(run!.categoryAudit!.length).toBe(1);
    expect(run!.categoryAudit![0]!.seedId).toBe('gpu');
    expect(run!.categoryAudit![0]!.failureKind).toBe('PARSE_FAILED');
  });

  it('pending items with zero fetches results in FAILED status', async () => {
    const publicRunId = '880e8400-e29b-41d4-a716-446655440003';

    const adapterWithProducts = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/cpu',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'cpu', scrapeRunId: publicRunId },
      }],
      parseCategoryPage: async (): Promise<CategoryParseResult> => ({
        products: [
          {
            canonicalUrl: 'https://www.sigma-computer.com/p1',
            externalId: 'p1',
            name: 'Product 1',
            sku: null,
            priceText: null,
            oldPriceText: null,
            availabilityText: null,
            brandName: null,
            thumbnailUrl: null,
            isStock: null,
          },
          {
            canonicalUrl: 'https://www.sigma-computer.com/p2',
            externalId: 'p2',
            name: 'Product 2',
            sku: null,
            priceText: null,
            oldPriceText: null,
            availabilityText: null,
            brandName: null,
            thumbnailUrl: null,
            isStock: null,
          },
        ],
        pagination: { totalItems: 2, perPage: 20, isNext: false, isPrevious: false },
      }),
    });

    // Make product fetcher fail: return valid HTML for category pages (so the adapter's
    // parseCategoryPage is called and products are discovered) but throw for product pages
    // (so totalFetched stays 0).
    streamSpy.mockImplementation(async (request: Record<string, unknown>) => {
      const url = String(request?.url ?? '');
      if (url.includes('/category/')) {
        return createMockStreamResponse('<html><body>category page</body></html>', url);
      }
      throw new Error('HTTP fetch failed: product fetcher is disabled for this test');
    });

    const orchestrator = createOrchestrator({ adapter: adapterWithProducts, dryRun: false });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'cpu',
      runId: publicRunId,
    });

    // Restore default mock for subsequent tests
    streamSpy.mockImplementation(async (request: Record<string, unknown>) => {
      const url = String(request?.url ?? '');
      return createMockStreamResponse('<html><body>product</body></html>', url);
    });

    expect(result.status).toBe('FAILED');
    expect(result.summary.totalDiscovered).toBe(2);
    expect(result.summary.totalFetched).toBe(0);
  });
});

describe('Orchestrator robots policy (ADR-003)', () => {
  let runRepository: ScrapeRunRepository;
  let itemRepository: ScrapeRunItemRepository;
  let snapshotRepository: RawProductSnapshotRepository;
  let discoveredProductRepository: DiscoveredProductRepository;
  const originalFetch = globalThis.fetch;
  const originalStorageClient = Configuration.getGlobalConfig().getStorageClient();

  beforeAll(async () => {
    await connectInMemoryDatabase();
    runRepository = new ScrapeRunRepository();
    itemRepository = new ScrapeRunItemRepository();
    snapshotRepository = new RawProductSnapshotRepository();
    discoveredProductRepository = new DiscoveredProductRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    // Isolate Crawlee request queue per test to prevent cross-test state pollution
    Configuration.getGlobalConfig().set('persistStorage', false);
    Configuration.getGlobalConfig().set('defaultRequestQueueId', `test-rq-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Configuration.getGlobalConfig().useStorageClient(originalStorageClient);
  });

  function createOrchestrator(overrides: Partial<OrchestratorConfig> = {}): Orchestrator {
    return new Orchestrator({
      adapter: createMockAdapter(),
      snapshotStore: createMockSnapshotStore() as unknown as OrchestratorConfig['snapshotStore'],
      runRepository,
      itemRepository,
      snapshotRepository,
      discoveredProductRepository,
      workerLock: createMockWorkerLock() as OrchestratorConfig['workerLock'],
      baseUrl: 'https://www.sigma-computer.com',
      dryRun: true,
      ...overrides,
    });
  }

  it('persists robotsDecision=ALLOWED and proceeds with CATEGORY run', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'User-agent: *\nAllow: /\n',
    });

    const publicRunId = 'robots-allow-001';
    const orchestrator = createOrchestrator({ dryRun: true });
    await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'cpu',
      runId: publicRunId,
    });

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run).toBeDefined();
    expect(run!.robotsDecision).toBe('ALLOWED');
  });

  it('persists robotsDecision=NOT_FOUND and proceeds with CATEGORY run', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    const publicRunId = 'robots-404-001';
    const orchestrator = createOrchestrator({ dryRun: true });
    await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'cpu',
      runId: publicRunId,
    });

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run).toBeDefined();
    expect(run!.robotsDecision).toBe('NOT_FOUND');
  });

  it('fails run with DENIED when robots.txt disallows crawling', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'User-agent: *\nDisallow: /en/\n',
    });

    const publicRunId = 'robots-deny-001';
    const orchestrator = createOrchestrator({ dryRun: true });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'cpu',
      runId: publicRunId,
    });

    expect(result.status).toBe('FAILED');
    expect(result.summary.totalDiscovered).toBe(0);

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run).toBeDefined();
    expect(run!.robotsDecision).toBe('DENIED');
    expect(run!.status).toBe('FAILED');
    expect(run!.completedAt).toBeDefined();
  });

  it('fails run with DENIED on transport error (fail-closed)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const publicRunId = 'robots-error-001';
    const orchestrator = createOrchestrator({ dryRun: true });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'gpu',
      runId: publicRunId,
    });

    expect(result.status).toBe('FAILED');

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run).toBeDefined();
    expect(run!.robotsDecision).toBe('DENIED');
  });

  it('persists robotsDecision=ALLOWED for FULL run', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'User-agent: *\nDisallow:\n',
    });

    const publicRunId = 'robots-full-001';
    const orchestrator = createOrchestrator({ dryRun: true });
    await orchestrator.executeRun({
      mode: 'FULL',
      runId: publicRunId,
    });

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run).toBeDefined();
    expect(run!.robotsDecision).toBe('ALLOWED');
  });

  it('does NOT check robots.txt for URL mode', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const publicRunId = 'robots-url-001';
    const orchestrator = createOrchestrator({ dryRun: true });
    await orchestrator.executeRun({
      mode: 'URL',
      runId: publicRunId,
      url: 'https://www.sigma-computer.com/en/product/test',
    });

    // fetch should not have been called for robots.txt
    expect(fetchSpy).not.toHaveBeenCalled();

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run).toBeDefined();
    expect(run!.robotsDecision).toBeUndefined();
  });
});

describe('Orchestrator pagination enqueue (TDD §8.3)', () => {
  let runRepository: ScrapeRunRepository;
  let itemRepository: ScrapeRunItemRepository;
  let snapshotRepository: RawProductSnapshotRepository;
  let discoveredProductRepository: DiscoveredProductRepository;
  const originalFetch = globalThis.fetch;
  const originalStorageClient = Configuration.getGlobalConfig().getStorageClient();

  beforeAll(async () => {
    await connectInMemoryDatabase();
    runRepository = new ScrapeRunRepository();
    itemRepository = new ScrapeRunItemRepository();
    snapshotRepository = new RawProductSnapshotRepository();
    discoveredProductRepository = new DiscoveredProductRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    // Isolate Crawlee request queue per test to prevent cross-test state pollution
    Configuration.getGlobalConfig().set('persistStorage', false);
    Configuration.getGlobalConfig().set('defaultRequestQueueId', `test-rq-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    // Mock fetch to return ALLOWED for robots.txt so discovery proceeds
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'User-agent: *\nAllow: /\n',
    });
    // Mock GotScrapingHttpClient.prototype.stream to prevent live HTTP to sigma.com.
    installHttpMock((url) => {
      if (url.includes('/category/')) return '<html></html>';
      return '<html><body>product</body></html>';
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetHttpMock();
    Configuration.getGlobalConfig().useStorageClient(originalStorageClient);
  });

  function createOrchestrator(overrides: Partial<OrchestratorConfig> = {}): Orchestrator {
    return new Orchestrator({
      adapter: createMockAdapter(),
      snapshotStore: createMockSnapshotStore() as unknown as OrchestratorConfig['snapshotStore'],
      runRepository,
      itemRepository,
      snapshotRepository,
      discoveredProductRepository,
      workerLock: createMockWorkerLock() as OrchestratorConfig['workerLock'],
      baseUrl: 'https://www.sigma-computer.com',
      dryRun: true,
      ...overrides,
    });
  }

  it('enqueues page 2 when isNext=true', async () => {
    const publicRunId = 'pagination-001';
    let pageCount = 0;

    const adapter = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/cpu',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'cpu', pageNumber: 1, scrapeRunId: '' },
      }],
      parseCategoryPage: async (): Promise<CategoryParseResult> => {
        pageCount++;
        if (pageCount === 1) {
          return {
            products: [
              { canonicalUrl: 'https://www.sigma-computer.com/p1', externalId: 'p1', name: 'P1', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
            ],
            pagination: { totalItems: 2, perPage: 1, isNext: true, isPrevious: false },
          };
        }
        return {
          products: [
            { canonicalUrl: 'https://www.sigma-computer.com/p2', externalId: 'p2', name: 'P2', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
          ],
          pagination: { totalItems: 2, perPage: 1, isNext: false, isPrevious: true },
        };
      },
    });

    const orchestrator = createOrchestrator({ adapter, dryRun: true });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'cpu',
      runId: publicRunId,
    });

    // Both pages should have been processed
    expect(pageCount).toBe(2);
    expect(result.summary.totalDiscovered).toBe(2);

    // Category audit should show completed
    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run!.categoryAudit).toBeDefined();
    expect(run!.categoryAudit!.length).toBe(1);
    expect(run!.categoryAudit![0]!.pagesProcessed).toBe(2);
    expect(run!.categoryAudit![0]!.completed).toBe(true);
    expect(run!.categoryAudit![0]!.failureKind).toBeUndefined();
  });

  it('stops at maxPagesPerCategory and records PAGE_LIMIT_EXCEEDED', async () => {
    const publicRunId = 'pagination-002';
    let pageCount = 0;

    const adapter = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/gpu',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'gpu', pageNumber: 1, scrapeRunId: '' },
      }],
      parseCategoryPage: async (): Promise<CategoryParseResult> => {
        pageCount++;
        return {
          products: [
            { canonicalUrl: `https://www.sigma-computer.com/gpu-${pageCount}`, externalId: `g${pageCount}`, name: `GPU ${pageCount}`, sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
          ],
          pagination: { totalItems: 100, perPage: 1, isNext: true, isPrevious: pageCount > 1 },
        };
      },
    });

    const orchestrator = createOrchestrator({
      adapter,
      dryRun: true,
      maxPagesPerCategory: 2,
    });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'gpu',
      runId: publicRunId,
    });

    // Should stop at 2 pages (maxPagesPerCategory=2)
    expect(pageCount).toBe(2);
    expect(result.summary.totalDiscovered).toBe(2);

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run!.categoryAudit![0]!.failureKind).toBe('PAGE_LIMIT_EXCEEDED');
  });

  it('records PAGINATION_LOOP when fingerprint repeats', async () => {
    const publicRunId = 'pagination-003';
    let pageCount = 0;

    const adapter = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/ram',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'ram', pageNumber: 1, scrapeRunId: '' },
      }],
      parseCategoryPage: async (): Promise<CategoryParseResult> => {
        pageCount++;
        // Return same products on page 2 → same fingerprint
        return {
          products: [
            { canonicalUrl: 'https://www.sigma-computer.com/ram-same', externalId: 'r1', name: 'RAM 1', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
          ],
          pagination: { totalItems: 1, perPage: 1, isNext: pageCount < 3, isPrevious: pageCount > 1 },
        };
      },
    });

    const orchestrator = createOrchestrator({ adapter, dryRun: true });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'ram',
      runId: publicRunId,
    });

    // Page 2 should be detected as loop (same fingerprint as page 1)
    expect(pageCount).toBe(2);
    expect(result.summary.totalDiscovered).toBe(1);

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run!.categoryAudit![0]!.failureKind).toBe('PAGINATION_LOOP');
  });

  it('does not enqueue when isNext=false', async () => {
    const publicRunId = 'pagination-004';
    let pageCount = 0;

    const adapter = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/storage',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'storage', pageNumber: 1, scrapeRunId: '' },
      }],
      parseCategoryPage: async (): Promise<CategoryParseResult> => {
        pageCount++;
        return {
          products: [
            { canonicalUrl: 'https://www.sigma-computer.com/s1', externalId: 's1', name: 'SSD 1', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
          ],
          pagination: { totalItems: 1, perPage: 20, isNext: false, isPrevious: false },
        };
      },
    });

    const orchestrator = createOrchestrator({ adapter, dryRun: true });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'storage',
      runId: publicRunId,
    });

    expect(pageCount).toBe(1);
    expect(result.summary.totalDiscovered).toBe(1);

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run!.categoryAudit![0]!.completed).toBe(true);
    expect(run!.categoryAudit![0]!.failureKind).toBeUndefined();
  });
});

describe('Orchestrator terminal status with category audit (ADR-003)', () => {
  let runRepository: ScrapeRunRepository;
  let itemRepository: ScrapeRunItemRepository;
  let snapshotRepository: RawProductSnapshotRepository;
  let discoveredProductRepository: DiscoveredProductRepository;
  const originalFetch = globalThis.fetch;
  const originalStorageClient = Configuration.getGlobalConfig().getStorageClient();

  beforeAll(async () => {
    await connectInMemoryDatabase();
    runRepository = new ScrapeRunRepository();
    itemRepository = new ScrapeRunItemRepository();
    snapshotRepository = new RawProductSnapshotRepository();
    discoveredProductRepository = new DiscoveredProductRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    // Isolate Crawlee request queue per test to prevent cross-test state pollution
    Configuration.getGlobalConfig().set('persistStorage', false);
    Configuration.getGlobalConfig().set('defaultRequestQueueId', `test-rq-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    // Mock fetch to return ALLOWED for robots.txt so discovery proceeds
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'User-agent: *\nAllow: /\n',
    });
    // Mock GotScrapingHttpClient.prototype.stream so no test hits the live network.
    installHttpMock((url) => {
      if (url.includes('/category/')) return '<html></html>';
      return '<html><body>product</body></html>';
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetHttpMock();
    Configuration.getGlobalConfig().useStorageClient(originalStorageClient);
  });

  function createOrchestrator(overrides: Partial<OrchestratorConfig> = {}): Orchestrator {
    return new Orchestrator({
      adapter: createMockAdapter(),
      snapshotStore: createMockSnapshotStore() as unknown as OrchestratorConfig['snapshotStore'],
      runRepository,
      itemRepository,
      snapshotRepository,
      discoveredProductRepository,
      workerLock: createMockWorkerLock() as OrchestratorConfig['workerLock'],
      baseUrl: 'https://www.sigma-computer.com',
      dryRun: true,
      ...overrides,
    });
  }

  it('returns PARTIALLY_FAILED when category has terminal failure but products were fetched', async () => {
    const publicRunId = 'status-001';
    let pageCount = 0;

    const adapter = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/cpu',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'cpu', pageNumber: 1, scrapeRunId: '' },
      }],
      parseCategoryPage: async (): Promise<CategoryParseResult> => {
        pageCount++;
        if (pageCount === 1) {
          // Page 1 returns products with isNext=true
          return {
            products: [
              { canonicalUrl: 'https://www.sigma-computer.com/cpu1', externalId: 'c1', name: 'CPU 1', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
            ],
            pagination: { totalItems: 2, perPage: 1, isNext: true, isPrevious: false },
          };
        }
        // Page 2 throws → PAGINATION_LOOP (same fingerprint) or parse failure
        throw new Error('PARSE_FAILED');
      },
    });

    const orchestrator = createOrchestrator({ adapter, dryRun: true });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'cpu',
      runId: publicRunId,
    });

    // Page 1 products discovered, page 2 failed → PARTIALLY_FAILED
    expect(result.status).toBe('PARTIALLY_FAILED');
    expect(result.summary.totalDiscovered).toBeGreaterThanOrEqual(1);
  });

  it('returns FAILED when category failure and no products were fetched', async () => {
    const publicRunId = 'status-002';

    const adapter = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/gpu',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'gpu', pageNumber: 1, scrapeRunId: '' },
      }],
      parseCategoryPage: async () => {
        throw new Error('PARSE_FAILED');
      },
    });

    const orchestrator = createOrchestrator({ adapter, dryRun: true });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'gpu',
      runId: publicRunId,
    });

    expect(result.status).toBe('FAILED');
    expect(result.summary.totalDiscovered).toBe(0);
  });

  it('returns SUCCEEDED when all categories completed and products fetched', async () => {
    // ADR-003: SUCCEEDED = all required stages complete with no terminal failures.
    // This test exercises the full discovery→fetch→SUCCEEDED path:
    //   1. Discovery crawler parses the category page (mock adapter returns 1 product)
    //   2. Fetch crawler fetches the product URL (mock got-scraping returns 200)
    //   3. handleProductPage marks item FETCHED → totalFetched=1
    //   4. finalizeRun: totalDiscovered=1, totalFetched=1, totalFailed=0 → SUCCEEDED
    const publicRunId = 'status-003';

    const adapter = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/cpu',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'cpu', pageNumber: 1, scrapeRunId: '' },
      }],
      parseCategoryPage: async (): Promise<CategoryParseResult> => ({
        products: [
          { canonicalUrl: 'https://www.sigma-computer.com/cpu1', externalId: 'c1', name: 'CPU 1', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
        ],
        pagination: { totalItems: 1, perPage: 20, isNext: false, isPrevious: false },
      }),
    });

    const orchestrator = createOrchestrator({ adapter, dryRun: false });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'cpu',
      runId: publicRunId,
    });

    // Category audit: completed with no terminal failure
    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run!.categoryAudit![0]!.completed).toBe(true);
    expect(run!.categoryAudit![0]!.failureKind).toBeUndefined();

    // Discovery and fetch both succeeded
    expect(result.summary.totalDiscovered).toBe(1);
    expect(result.summary.totalFetched).toBe(1);
    expect(result.status).toBe('SUCCEEDED');
  });

  it('returns PARTIALLY_FAILED when category incomplete and products fetched', async () => {
    const publicRunId = 'status-004';
    let pageCount = 0;

    const adapter = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/ram',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'ram', pageNumber: 1, scrapeRunId: '' },
      }],
      parseCategoryPage: async (): Promise<CategoryParseResult> => {
        pageCount++;
        if (pageCount === 1) {
          return {
            products: [
              { canonicalUrl: 'https://www.sigma-computer.com/ram1', externalId: 'r1', name: 'RAM 1', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
            ],
            pagination: { totalItems: 2, perPage: 1, isNext: true, isPrevious: false },
          };
        }
        throw new Error('TIMEOUT');
      },
    });

    const orchestrator = createOrchestrator({ adapter, dryRun: true });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'ram',
      runId: publicRunId,
    });

    // Page 1 ok, page 2 timeout → category not completed, has failureKind
    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run!.categoryAudit![0]!.completed).toBe(false);
    expect(run!.categoryAudit![0]!.failureKind).toBe('TIMEOUT');

    // Products were discovered but category didn't complete → PARTIALLY_FAILED
    // ADR-003: category audit check runs before totalFetched check.
    // totalDiscovered=1 > 0 with a terminal category failure → PARTIALLY_FAILED.
    expect(result.status).toBe('PARTIALLY_FAILED');
  });

  it('returns PARTIALLY_FAILED when pagination enqueued but not executed (M2-BUG-001)', async () => {
    // M2-BUG-001: page 1 reports isNext=true, page 2 is enqueued but the HTTP
    // layer fails (simulating the real-world scenario where enqueued pages are
    // never successfully processed). The category audit should show completed=false.
    // Status must be PARTIALLY_FAILED (not SUCCEEDED) when useful data exists.
    //
    // Note: In a test environment Crawlee always attempts enqueued requests, so
    // page 2 IS attempted but fails at the HTTP layer. The failedRequestHandler
    // records a category failure. The critical invariant under test is that
    // determineStatus returns PARTIALLY_FAILED (never SUCCEEDED) when category
    // audits are incomplete — regardless of whether a failureKind is set.
    const publicRunId = 'status-m2bug-001';
    let pageCount = 0;

    const adapter = createMockAdapter({
      getSeedRequests: () => [{
        url: 'https://www.sigma-computer.com/en/category/ssd',
        userData: { label: 'CATEGORY_PAGE', categoryHint: 'ssd', pageNumber: 1, scrapeRunId: '' },
      }],
      parseCategoryPage: async (): Promise<CategoryParseResult> => {
        pageCount++;
        if (pageCount === 1) {
          return {
            products: [
              { canonicalUrl: 'https://www.sigma-computer.com/ssd1', externalId: 's1', name: 'SSD 1', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
            ],
            pagination: { totalItems: 2, perPage: 1, isNext: true, isPrevious: false },
          };
        }
        throw new Error('PAGE 2 SHOULD NOT BE CALLED');
      },
    });

    // Simulate M2-BUG-001: page 1 is fetched successfully, page 2 fails at the
    // HTTP layer (stream throws), so the requestHandler never runs for page 2.
    // The failedRequestHandler records a category failure, but the audit remains
    // completed=false because no terminal page was reached.
    streamSpy.mockImplementation(async (request: Record<string, unknown>) => {
      const url = String(request?.url ?? '');
      if (url.includes('/category/ssd') && !url.includes('page=2')) {
        return createMockStreamResponse('<html><body>category page 1</body></html>', url);
      }
      // Page 2: simulate network failure — enqueued but not successfully executed
      throw new Error('ENOTFOUND - simulated network error for page 2');
    });

    const orchestrator = createOrchestrator({ adapter, dryRun: true });
    const result = await orchestrator.executeRun({
      mode: 'CATEGORY',
      seedId: 'ssd',
      runId: publicRunId,
    });

    // Only page 1 was successfully processed by the adapter
    expect(pageCount).toBe(1);

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run!.categoryAudit).toBeDefined();
    expect(run!.categoryAudit!.length).toBe(1);
    // M2-BUG-001 invariant: completed stays false because no terminal page was reached
    expect(run!.categoryAudit![0]!.completed).toBe(false);
    expect(run!.categoryAudit![0]!.pagesProcessed).toBe(1);
    expect(run!.categoryAudit![0]!.productsDiscovered).toBe(1);

    // Useful data was discovered → must be PARTIALLY_FAILED, never SUCCEEDED
    expect(result.status).toBe('PARTIALLY_FAILED');
    expect(result.summary.totalDiscovered).toBeGreaterThanOrEqual(1);
  });

  it('returns SUCCEEDED only when all categories completed and no failures', async () => {
    // Explicit guard: even with multiple categories, SUCCEEDED requires all completed.
    const publicRunId = 'status-multi-succeed';

    const adapter = createMockAdapter({
      getSeedRequests: () => [
        {
          url: 'https://www.sigma-computer.com/en/category/cpu',
          userData: { label: 'CATEGORY_PAGE', categoryHint: 'cpu', pageNumber: 1, scrapeRunId: '' },
        },
        {
          url: 'https://www.sigma-computer.com/en/category/gpu',
          userData: { label: 'CATEGORY_PAGE', categoryHint: 'gpu', pageNumber: 1, scrapeRunId: '' },
        },
      ],
      parseCategoryPage: async (ctx: CategoryPageContext): Promise<CategoryParseResult> => ({
        products: [
          { canonicalUrl: `https://www.sigma-computer.com/${ctx.categoryHint}-1`, externalId: `${ctx.categoryHint}-1`, name: `${ctx.categoryHint} 1`, sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
        ],
        pagination: { totalItems: 1, perPage: 20, isNext: false, isPrevious: false },
      }),
    });

    const orchestrator = createOrchestrator({ adapter, dryRun: false });
    const result = await orchestrator.executeRun({
      mode: 'FULL',
      runId: publicRunId,
    });

    const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
    expect(run!.categoryAudit!.length).toBe(2);
    expect(run!.categoryAudit!.every((a) => a.completed)).toBe(true);
    expect(run!.categoryAudit!.every((a) => a.failureKind === undefined)).toBe(true);

    expect(result.summary.totalDiscovered).toBe(2);
    expect(result.summary.totalFetched).toBe(2);
    expect(result.status).toBe('SUCCEEDED');
  });

  describe('same-domain enforcement', () => {
    it('rejects off-domain URLs in discovery crawler', async () => {
      const publicRunId = 'off-domain-discovery';
      const adapter = createMockAdapter({
        getSeedRequests: () => [{
          url: 'https://www.sigma-computer.com/en/category/gpu',
          userData: { label: 'CATEGORY_PAGE', categoryHint: 'gpu', pageNumber: 1, scrapeRunId: '' },
        }],
        parseCategoryPage: async () => ({
          products: [
            { canonicalUrl: 'https://evil.com/malicious', externalId: 'e1', name: 'Evil Product', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
          ],
          pagination: { totalItems: 1, perPage: 20, isNext: false, isPrevious: false },
        }),
      });

      const orchestrator = createOrchestrator({ adapter, dryRun: true });
      const result = await orchestrator.executeRun({
        mode: 'FULL',
        runId: publicRunId,
      });

      // Off-domain URL should be rejected, not fetched
      expect(result.summary.totalDiscovered).toBe(1);
      expect(result.status).toBe('FAILED');
    });

    it('off-domain product URL is attempted exactly once and classified OFF_DOMAIN_REDIRECT', async () => {
      const publicRunId = 'off-domain-no-retry';

      const adapter = createMockAdapter({
        getSeedRequests: () => [{
          url: 'https://www.sigma-computer.com/en/category/gpu',
          userData: { label: 'CATEGORY_PAGE', categoryHint: 'gpu', pageNumber: 1, scrapeRunId: '' },
        }],
        parseCategoryPage: async () => ({
          products: [
            { canonicalUrl: 'https://evil.com/malicious', externalId: 'e1', name: 'Evil Product', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
          ],
          pagination: { totalItems: 1, perPage: 20, isNext: false, isPrevious: false },
        }),
      });

      const orchestrator = createOrchestrator({ adapter, dryRun: false });
      const result = await orchestrator.executeRun({
        mode: 'FULL',
        runId: publicRunId,
      });

      // The off-domain product URL should be attempted exactly once (no retry due to noRetry flag)
      // The preNavigationHook rejects it before HTTP, so handleProductPage is never called.
      // Status is FAILED because totalFetched=0 (no product successfully fetched).
      expect(result.status).toBe('FAILED');
      expect(result.summary.totalDiscovered).toBe(1);

      // Verify OFF_DOMAIN_REDIRECT classification via the product item
      const run = await runRepository.findByRunId(publicRunId, 'SIGMA');
      expect(run).toBeDefined();
      const items = await itemRepository.findByRunId(run!._id);
      expect(items).toHaveLength(1);
      expect(items[0]!.fetchState).toBe('FAILED');
      expect(items[0]!.failureKind).toBe('OFF_DOMAIN_REDIRECT');
    });

    it('accepts same-domain URLs in product crawler', async () => {
      const publicRunId = 'same-domain-product';
      let fetchCount = 0;

      const adapter = createMockAdapter({
        getSeedRequests: () => [{
          url: 'https://www.sigma-computer.com/en/category/gpu',
          userData: { label: 'CATEGORY_PAGE', categoryHint: 'gpu', pageNumber: 1, scrapeRunId: '' },
        }],
        parseCategoryPage: async () => ({
          products: [
            { canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-1', externalId: 'p1', name: 'Product 1', sku: null, priceText: null, oldPriceText: null, availabilityText: null, brandName: null, thumbnailUrl: null, isStock: null },
          ],
          pagination: { totalItems: 1, perPage: 20, isNext: false, isPrevious: false },
        }),
        parseProductPage: async () => {
          fetchCount++;
          return {
            externalId: 'p1',
            canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-1',
            sourceUrl: 'https://www.sigma-computer.com/en/item?id=product-1',
            httpStatus: 200,
            responseContentType: 'text/html',
            parserVersion: '0.1.0',
            parseStatus: 'OK',
            raw: {
              title: 'Product 1',
              priceText: '1500',
              oldPriceText: null,
              availabilityText: 'true',
              skuText: 'SKU-1',
              brandText: 'Brand',
              modelText: null,
              partNumberText: null,
              breadcrumbs: [],
              specifications: [],
              imageUrls: [],
              descriptionText: null,
            },
            warnings: [],
          };
        },
      });

      const orchestrator = createOrchestrator({ adapter, dryRun: false });
      const result = await orchestrator.executeRun({
        mode: 'FULL',
        runId: publicRunId,
      });

      expect(fetchCount).toBe(1);
      expect(result.summary.totalFetched).toBe(1);
      expect(result.status).toBe('SUCCEEDED');
    });
  });
});
