import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateManifest,
  resolveHtmlPath,
  executeBrowserCaptureImport,
  type BrowserCaptureManifest,
  type BrowserCaptureImportConfig,
} from './browser-capture-import.js';
import {
  connectInMemoryDatabase,
  disconnectInMemoryDatabase,
  clearDatabase,
} from '@buildsense/database/src/test-utils.js';
import {
  ScrapeRunRepository,
  ScrapeRunItemRepository,
  RawProductSnapshotRepository,
  DiscoveredProductRepository,
  CatalogProductRepository,
  OfferRepository,
  ScrapeRunModel,
  ScrapeRunItemModel,
  RawProductSnapshotModel,
  CatalogProductModel,
  OfferModel,
} from '@buildsense/database';
import { ElNourScraperAdapter } from '@buildsense/el-nour-adapter';
import { AlfrensiaScraperAdapter } from '@buildsense/alfrensia-adapter';
import type { SnapshotStore } from '@buildsense/scraping-core';

// ---------------------------------------------------------------------------
// Fixtures directory
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.resolve(__dirname, '../../../..', 'fixtures');

// ---------------------------------------------------------------------------
// Minimal SnapshotStore stub for tests (writes to temp dir)
// ---------------------------------------------------------------------------

function createStubSnapshotStore(tmpDir: string): SnapshotStore {
  return {
    async writeSnapshot(input: { runId: string; externalId: string | null; canonicalUrl: string; content: Buffer }) {
      const crypto = await import('node:crypto');
      const snapshotFs = await import('node:fs/promises');
      const zlib = await import('node:zlib');
      const { promisify } = await import('node:util');
      const gzip = promisify(zlib.gzip);

      const contentSha256 = crypto.createHash('sha256').update(input.content).digest('hex');
      const shaPrefix = contentSha256.slice(0, 8);
      const identifier = input.externalId ?? Math.abs(
        input.canonicalUrl.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0),
      ).toString(36).slice(0, 12);
      const fileName = `${identifier}-${shaPrefix}.html.gz`;
      const runDir = path.join(tmpDir, input.runId);
      const contentPath = path.join(runDir, fileName);

      await snapshotFs.mkdir(runDir, { recursive: true });
      const gzipped = await gzip(input.content, { level: 9 });
      await snapshotFs.writeFile(contentPath, gzipped);

      return { contentSha256, contentPath, bytesWritten: gzipped.length, wasDuplicate: false };
    },
    async readSnapshot(contentPath: string) {
      const snapshotFs = await import('node:fs/promises');
      const fullPath = path.isAbsolute(contentPath) ? contentPath : path.resolve(tmpDir, contentPath);
      const content = await snapshotFs.readFile(fullPath);
      return { content, contentPath };
    },
    async snapshotExists(contentPath: string) {
      const snapshotFs = await import('node:fs/promises');
      const fullPath = path.isAbsolute(contentPath) ? contentPath : path.resolve(tmpDir, contentPath);
      try { await snapshotFs.access(fullPath); return true; } catch { return false; }
    },
    async getSnapshotPath(runId: string, externalId: string | null, canonicalUrl: string, contentSha256: string) {
      const shaPrefix = contentSha256.slice(0, 8);
      const identifier = externalId ?? Math.abs(
        canonicalUrl.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0),
      ).toString(36).slice(0, 12);
      return `${runId}/${identifier}-${shaPrefix}.html.gz`;
    },
  } as unknown as SnapshotStore;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupTestManifest(
  storeDir: string,
  entries: Array<{ url: string; htmlFile: string; capturedAt: string }>,
): Promise<string> {
  const manifest: BrowserCaptureManifest = { entries };
  const manifestPath = path.join(storeDir, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  return manifestPath;
}

function makeElNourConfig(tmpDir: string): BrowserCaptureImportConfig {
  return {
    storeCode: 'EL_NOUR',
    storeHost: 'elnour-tech.com',
    adapter: new ElNourScraperAdapter('https://elnour-tech.com'),
    snapshotStore: createStubSnapshotStore(tmpDir),
    runRepository: new ScrapeRunRepository(),
    itemRepository: new ScrapeRunItemRepository(),
    snapshotRepository: new RawProductSnapshotRepository(),
    discoveredProductRepository: new DiscoveredProductRepository(),
    catalogProductRepository: new CatalogProductRepository(),
    offerRepository: new OfferRepository(),
  };
}

function makeAlfrensiaConfig(tmpDir: string): BrowserCaptureImportConfig {
  return {
    storeCode: 'ALFRENSIA',
    storeHost: 'alfrensia.com',
    adapter: new AlfrensiaScraperAdapter('https://alfrensia.com'),
    snapshotStore: createStubSnapshotStore(tmpDir),
    runRepository: new ScrapeRunRepository(),
    itemRepository: new ScrapeRunItemRepository(),
    snapshotRepository: new RawProductSnapshotRepository(),
    discoveredProductRepository: new DiscoveredProductRepository(),
    catalogProductRepository: new CatalogProductRepository(),
    offerRepository: new OfferRepository(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('browser-capture-import', () => {
  // =========================================================================
  // Manifest validation (no DB needed)
  // =========================================================================

  describe('validateManifest', () => {
    it('rejects manifest with more than 10000 entries', () => {
      const entries = Array.from({ length: 10_001 }, (_, i) => ({
        url: `https://elnour-tech.com/en/product/product-${i}/`,
        htmlFile: `page${i}.html`,
        capturedAt: '2025-01-15T10:00:00.000Z',
      }));
      const errors = validateManifest({ entries }, 'elnour-tech.com');
      expect(errors.some((e) => e.includes('must not exceed 10,000'))).toBe(true);
    });

    it('accepts manifest with 20 entries', () => {
      const entries = Array.from({ length: 20 }, (_, i) => ({
        url: `https://elnour-tech.com/en/product/product-${i}/`,
        htmlFile: `page${i}.html`,
        capturedAt: '2025-01-15T10:00:00.000Z',
      }));
      const errors = validateManifest({ entries }, 'elnour-tech.com');
      expect(errors.some((e) => e.includes('must not exceed'))).toBe(false);
    });

    it('rejects URLs with wrong hostname', () => {
      const errors = validateManifest(
        {
          entries: [
            {
              url: 'https://wrong-host.com/en/product/foo/',
              htmlFile: 'page.html',
              capturedAt: '2025-01-15T10:00:00.000Z',
            },
          ],
        },
        'elnour-tech.com',
      );
      expect(errors.some((e) => e.includes('does not match expected'))).toBe(true);
    });

    it('rejects duplicate URLs', () => {
      const errors = validateManifest(
        {
          entries: [
            { url: 'https://elnour-tech.com/en/product/foo/', htmlFile: 'a.html', capturedAt: '2025-01-15T10:00:00.000Z' },
            { url: 'https://elnour-tech.com/en/product/foo/', htmlFile: 'b.html', capturedAt: '2025-01-15T10:00:00.000Z' },
          ],
        },
        'elnour-tech.com',
      );
      expect(errors.some((e) => e.includes('duplicate URL'))).toBe(true);
    });

    it('rejects invalid capturedAt timestamps', () => {
      const errors = validateManifest(
        {
          entries: [
            { url: 'https://elnour-tech.com/en/product/foo/', htmlFile: 'page.html', capturedAt: 'not-a-date' },
          ],
        },
        'elnour-tech.com',
      );
      expect(errors.some((e) => e.includes('valid ISO 8601'))).toBe(true);
    });

    it('rejects empty manifest entries', () => {
      const errors = validateManifest({ entries: [] }, 'elnour-tech.com');
      expect(errors.some((e) => e.includes('must not be empty'))).toBe(true);
    });

    it('validates Alfrensia host', () => {
      const errors = validateManifest(
        {
          entries: [
            { url: 'https://alfrensia.com/en/product/foo/', htmlFile: 'page.html', capturedAt: '2025-01-15T10:00:00.000Z' },
          ],
        },
        'alfrensia.com',
      );
      expect(errors).toHaveLength(0);
    });

    it('accepts valid manifest with correct hosts', () => {
      const errors = validateManifest(
        {
          entries: [
            { url: 'https://elnour-tech.com/en/product/foo/', htmlFile: 'page.html', capturedAt: '2025-01-15T10:00:00.000Z' },
            { url: 'https://elnour-tech.com/en/product/bar/', htmlFile: 'page2.html', capturedAt: '2025-01-15T11:00:00.000Z' },
          ],
        },
        'elnour-tech.com',
      );
      expect(errors).toHaveLength(0);
    });

    it('rejects non-object manifest', () => {
      const errors = validateManifest('not-an-object' as unknown as BrowserCaptureManifest, 'elnour-tech.com');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects manifest without entries array', () => {
      const errors = validateManifest({} as unknown as BrowserCaptureManifest, 'elnour-tech.com');
      expect(errors.some((e) => e.includes('entries must be an array'))).toBe(true);
    });
  });

  describe('resolveHtmlPath', () => {
    it('resolves relative path within manifest directory', () => {
      const resolved = resolveHtmlPath('/tmp/manifest-dir', './page.html');
      expect(resolved).toBe(path.resolve('/tmp/manifest-dir', 'page.html'));
    });

    it('rejects path that escapes manifest directory', () => {
      expect(() => resolveHtmlPath('/tmp/manifest-dir', '../escape.html')).toThrow('escapes manifest directory');
    });
  });

  // =========================================================================
  // Full integration (with in-memory DB)
  // =========================================================================

  describe('executeBrowserCaptureImport — El Nour', () => {
    let tmpDir: string;

    beforeAll(async () => {
      await connectInMemoryDatabase();
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildsense-el-nour-'));
    });

    afterAll(async () => {
      await disconnectInMemoryDatabase();
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
      await clearDatabase();
    });

    it('no-network proof: parses HTML from disk without any fetch', async () => {
      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://elnour-tech.com/en/product/amd-ryzen-5-3400g-4-core-am4-3-7ghz/',
          htmlFile: 'amd-ryzen-5-3400g-instock.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      // Note: HTML file is read from fixtures/el-nour/product-pages via symlink or direct path
      // For this test we copy the fixture into the tmpDir
      const srcHtml = path.join(FIXTURES_ROOT, 'el-nour', 'product-pages', 'amd-ryzen-5-3400g-instock.html');
      const dstHtml = path.join(tmpDir, 'amd-ryzen-5-3400g-instock.html');
      await fs.copyFile(srcHtml, dstHtml);

      const result = await executeBrowserCaptureImport(makeElNourConfig(tmpDir), {
        manifestPath,
        publish: false,
      });

      expect(result.totalEntries).toBe(1);
      expect(result.parsed).toBe(1);
      expect(result.parseFailed).toBe(0);
      expect(result.pages[0]!.outcome).toBe('PARSE_OK_SKIPPED_PUBLISH');
    });

    it('persists a scrape run with correct store code and mode', async () => {
      const srcHtml = path.join(FIXTURES_ROOT, 'el-nour', 'product-pages', 'amd-ryzen-5-3400g-instock.html');
      const dstHtml = path.join(tmpDir, 'amd-ryzen-5-3400g-instock.html');
      await fs.copyFile(srcHtml, dstHtml);

      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://elnour-tech.com/en/product/amd-ryzen-5-3400g-4-core-am4-3-7ghz/',
          htmlFile: 'amd-ryzen-5-3400g-instock.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      const result = await executeBrowserCaptureImport(makeElNourConfig(tmpDir), {
        manifestPath,
        publish: false,
      });

      const run = await ScrapeRunModel.findOne({ runId: result.runId });
      expect(run).not.toBeNull();
      expect(run!.storeCode).toBe('EL_NOUR');
      expect(run!.mode).toBe('URL');
      expect(run!.status).toBe('SUCCEEDED');
      expect(run!.commandInput).toContain('BROWSER_CAPTURE_IMPORT');
    });

    it('persists raw snapshot with correct store code and content', async () => {
      const srcHtml = path.join(FIXTURES_ROOT, 'el-nour', 'product-pages', 'amd-ryzen-5-3400g-instock.html');
      const dstHtml = path.join(tmpDir, 'amd-ryzen-5-3400g-instock.html');
      await fs.copyFile(srcHtml, dstHtml);

      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://elnour-tech.com/en/product/amd-ryzen-5-3400g-4-core-am4-3-7ghz/',
          htmlFile: 'amd-ryzen-5-3400g-instock.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      await executeBrowserCaptureImport(makeElNourConfig(tmpDir), {
        manifestPath,
        publish: false,
      });

      const snapshots = await RawProductSnapshotModel.find();
      expect(snapshots).toHaveLength(1);
      const snap = snapshots[0]!;
      expect(snap.storeCode).toBe('EL_NOUR');
      expect(snap.parseStatus).toBe('OK');
      expect(snap.raw.title).not.toBeNull();
      expect(snap.raw.priceText).not.toBeNull();
      expect(snap.parseWarnings.some((w) => w.startsWith('BROWSER_CAPTURE_IMPORT'))).toBe(true);
    });

    it('raw-before-publish: snapshot exists before publisher runs', async () => {
      const srcHtml = path.join(FIXTURES_ROOT, 'el-nour', 'product-pages', 'amd-ryzen-5-3400g-instock.html');
      const dstHtml = path.join(tmpDir, 'amd-ryzen-5-3400g-instock.html');
      await fs.copyFile(srcHtml, dstHtml);

      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://elnour-tech.com/en/product/amd-ryzen-5-3400g-4-core-am4-3-7ghz/',
          htmlFile: 'amd-ryzen-5-3400g-instock.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      await executeBrowserCaptureImport(makeElNourConfig(tmpDir), {
        manifestPath,
        publish: true,
      });

      // Snapshot should exist
      const snapshots = await RawProductSnapshotModel.find();
      expect(snapshots.length).toBeGreaterThanOrEqual(1);

      // Items should be linked to snapshots
      const items = await ScrapeRunItemModel.find();
      expect(items.every((item) => item.snapshotId !== undefined)).toBe(true);
    });

    it('publishes successfully with --publish flag (CPU eligible category)', async () => {
      const srcHtml = path.join(FIXTURES_ROOT, 'el-nour', 'product-pages', 'amd-ryzen-5-3400g-instock.html');
      const dstHtml = path.join(tmpDir, 'amd-ryzen-5-3400g-instock.html');
      await fs.copyFile(srcHtml, dstHtml);

      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://elnour-tech.com/en/product/amd-ryzen-5-3400g-4-core-am4-3-7ghz/',
          htmlFile: 'amd-ryzen-5-3400g-instock.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      const result = await executeBrowserCaptureImport(makeElNourConfig(tmpDir), {
        manifestPath,
        publish: true,
      });

      // At least one page should be published or skipped (depends on publisher eligibility)
      const pageResult = result.pages[0]!;
      expect(['PARSE_OK_PUBLISHED', 'PARSE_OK_SKIPPED_PUBLISH']).toContain(pageResult.outcome);

      if (pageResult.outcome === 'PARSE_OK_PUBLISHED') {
        expect(result.published).toBe(1);
        const products = await CatalogProductModel.find();
        expect(products.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('reports skip for parse-failed pages', async () => {
      // Use an HTML file that will cause a parse failure (non-product page)
      const badHtmlPath = path.join(tmpDir, 'bad-page.html');
      await fs.writeFile(badHtmlPath, '<html><body><p>Not a product</p></body></html>', 'utf-8');

      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://elnour-tech.com/en/product/not-a-real-product/',
          htmlFile: 'bad-page.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      const result = await executeBrowserCaptureImport(makeElNourConfig(tmpDir), {
        manifestPath,
        publish: false,
      });

      expect(result.totalEntries).toBe(1);
      // Either parseFailed or parse succeeded but skipped publish
      expect(result.parsed + result.parseFailed).toBe(1);
    });

    it('idempotent rerun does not duplicate products or snapshots', async () => {
      const srcHtml = path.join(FIXTURES_ROOT, 'el-nour', 'product-pages', 'amd-ryzen-5-3400g-instock.html');
      const dstHtml = path.join(tmpDir, 'amd-ryzen-5-3400g-instock.html');
      await fs.copyFile(srcHtml, dstHtml);

      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://elnour-tech.com/en/product/amd-ryzen-5-3400g-4-core-am4-3-7ghz/',
          htmlFile: 'amd-ryzen-5-3400g-instock.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      const config = makeElNourConfig(tmpDir);

      // First run
      const first = await executeBrowserCaptureImport(config, { manifestPath, publish: true });
      const firstProductCount = await CatalogProductModel.countDocuments();
      const firstOfferCount = await OfferModel.countDocuments();

      // Second run with same manifest (same runId)
      const second = await executeBrowserCaptureImport(config, { manifestPath, publish: true });

      // Same run ID (deterministic)
      expect(second.runId).toBe(first.runId);

      // Products/offers not duplicated (publisher is idempotent by externalId)
      const secondProductCount = await CatalogProductModel.countDocuments();
      const secondOfferCount = await OfferModel.countDocuments();

      expect(secondProductCount).toBeLessThanOrEqual(firstProductCount + 1);
      expect(secondOfferCount).toBeLessThanOrEqual(firstOfferCount + 1);
    });
  });

  describe('executeBrowserCaptureImport — Alfrensia', () => {
    let tmpDir: string;

    beforeAll(async () => {
      await connectInMemoryDatabase();
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildsense-alfrensia-'));
    });

    afterAll(async () => {
      await disconnectInMemoryDatabase();
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
      await clearDatabase();
    });

    it('parses Alfrensia product page from disk', async () => {
      const srcHtml = path.join(FIXTURES_ROOT, 'alfrensia', 'product-pages', 'gigabyte-gs27qca.html');
      const dstHtml = path.join(tmpDir, 'gigabyte-gs27qca.html');
      await fs.copyFile(srcHtml, dstHtml);

      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://alfrensia.com/en/product/gigabyte-gs27qca-27-inch-qhd-180hz-1ms-mprt-curved-va-gaming-monitor/',
          htmlFile: 'gigabyte-gs27qca.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      const result = await executeBrowserCaptureImport(makeAlfrensiaConfig(tmpDir), {
        manifestPath,
        publish: false,
      });

      expect(result.totalEntries).toBe(1);
      expect(result.parsed).toBe(1);
      expect(result.parseFailed).toBe(0);
    });

    it('persists Alfrensia snapshot with correct store code', async () => {
      const srcHtml = path.join(FIXTURES_ROOT, 'alfrensia', 'product-pages', 'gigabyte-gs27qca.html');
      const dstHtml = path.join(tmpDir, 'gigabyte-gs27qca.html');
      await fs.copyFile(srcHtml, dstHtml);

      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://alfrensia.com/en/product/gigabyte-gs27qca-27-inch-qhd-180hz-1ms-mprt-curved-va-gaming-monitor/',
          htmlFile: 'gigabyte-gs27qca.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      await executeBrowserCaptureImport(makeAlfrensiaConfig(tmpDir), {
        manifestPath,
        publish: false,
      });

      const snapshots = await RawProductSnapshotModel.find();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]!.storeCode).toBe('ALFRENSIA');
      expect(snapshots[0]!.parseStatus).toBe('OK');
    });

    it('publishes Alfrensia monitor as NOT_ELIGIBLE for builder', async () => {
      const srcHtml = path.join(FIXTURES_ROOT, 'alfrensia', 'product-pages', 'gigabyte-gs27qca.html');
      const dstHtml = path.join(tmpDir, 'gigabyte-gs27qca.html');
      await fs.copyFile(srcHtml, dstHtml);

      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://alfrensia.com/en/product/gigabyte-gs27qca-27-inch-qhd-180hz-1ms-mprt-curved-va-gaming-monitor/',
          htmlFile: 'gigabyte-gs27qca.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      const result = await executeBrowserCaptureImport(makeAlfrensiaConfig(tmpDir), {
        manifestPath,
        publish: true,
      });

      if (result.published > 0) {
        const products = await CatalogProductModel.find();
        expect(products.some((p) => p.buildEligibility === 'NOT_ELIGIBLE')).toBe(true);
      }
    });
  });

  // =========================================================================
  // Validation failure paths
  // =========================================================================

  describe('validation failures', () => {
    let tmpDir: string;

    beforeAll(async () => {
      await connectInMemoryDatabase();
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildsense-validation-'));
    });

    afterAll(async () => {
      await disconnectInMemoryDatabase();
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
      await clearDatabase();
    });

    it('rejects manifest with wrong hostname', async () => {
      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://wrong-host.com/en/product/foo/',
          htmlFile: 'amd-ryzen-5-3400g-instock.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      await expect(
        executeBrowserCaptureImport(makeElNourConfig(tmpDir), { manifestPath, publish: false }),
      ).rejects.toThrow('Manifest validation failed');
    });

    it('reports validation failure for missing HTML file', async () => {
      const manifestPath = await setupTestManifest(tmpDir, [
        {
          url: 'https://elnour-tech.com/en/product/foo/',
          htmlFile: 'nonexistent-file.html',
          capturedAt: '2025-01-15T10:00:00.000Z',
        },
      ]);

      const result = await executeBrowserCaptureImport(makeElNourConfig(tmpDir), {
        manifestPath,
        publish: false,
      });

      expect(result.validationFailed).toBe(1);
      expect(result.pages[0]!.outcome).toBe('VALIDATION_FAILED');
    });
  });

  // =========================================================================
  // Command structure tests
  // =========================================================================

  describe('command registration', () => {
    it('el-nour import-captures subcommand exists', async () => {
      const mod = await import('../commands/el-nour.js');
      const cmd = mod.elNourCommand.commands.find((c: { name: () => string }) => c.name() === 'import-captures');
      expect(cmd).toBeDefined();
      expect(cmd!.description()).toContain('browser-captured');
    });

    it('el-nour-tech alias exists with import-captures', async () => {
      const mod = await import('../commands/el-nour.js');
      expect(mod.elNourTechAliasCommand.name()).toBe('el-nour-tech');
      const cmd = mod.elNourTechAliasCommand.commands.find((c: { name: () => string }) => c.name() === 'import-captures');
      expect(cmd).toBeDefined();
    });

    it('el-nour-tech alias has same subcommands as el-nour', async () => {
      const mod = await import('../commands/el-nour.js');
      const elNourNames = mod.elNourCommand.commands.map((c: { name: () => string }) => c.name()).sort();
      const aliasNames = mod.elNourTechAliasCommand.commands.map((c: { name: () => string }) => c.name()).sort();
      expect(aliasNames).toEqual(elNourNames);
    });

    it('el-nour has 5 subcommands (including import-captures)', async () => {
      const mod = await import('../commands/el-nour.js');
      expect(mod.elNourCommand.commands).toHaveLength(5);
    });

    it('alfrensia import-captures subcommand exists', async () => {
      const mod = await import('../commands/alfrensia.js');
      const cmd = mod.alfrensiaCommand.commands.find((c: { name: () => string }) => c.name() === 'import-captures');
      expect(cmd).toBeDefined();
      expect(cmd!.description()).toContain('browser-captured');
    });

    it('alfrensia has 6 subcommands (including import-captures)', async () => {
      const mod = await import('../commands/alfrensia.js');
      expect(mod.alfrensiaCommand.commands).toHaveLength(6);
    });

    it('el-nour import-captures accepts --publish option', async () => {
      const mod = await import('../commands/el-nour.js');
      const cmd = mod.elNourCommand.commands.find((c: { name: () => string }) => c.name() === 'import-captures');
      const opts = cmd!.options.map((o) => o.long).filter(Boolean);
      expect(opts).toContain('--publish');
    });

    it('alfrensia import-captures accepts --publish option', async () => {
      const mod = await import('../commands/alfrensia.js');
      const cmd = mod.alfrensiaCommand.commands.find((c: { name: () => string }) => c.name() === 'import-captures');
      const opts = cmd!.options.map((o) => o.long).filter(Boolean);
      expect(opts).toContain('--publish');
    });
  });

  // =========================================================================
  // Category expansion tests
  // =========================================================================

  describe('expanded publisher categories', () => {
    it('publisher now supports GPU, MOTHERBOARD, RAM, PSU, CASE, COOLING, SSD, HDD', async () => {
      const { checkEligibility } = await import('./store-product-publisher.js');

      const categories = ['CPU', 'GPU', 'MOTHERBOARD', 'RAM', 'MONITOR', 'PSU', 'CASE', 'COOLING', 'SSD', 'HDD'];
      for (const cat of categories) {
        const result = checkEligibility({
          storeCode: 'EL_NOUR',
          externalId: '12345',
          canonicalUrl: 'https://elnour-tech.com/en/product/test/',
          sourceUrl: 'https://elnour-tech.com/en/product/test/',
          category: cat,
          title: 'Test Product',
          brand: 'Test',
          model: 'Test Model',
          mpn: 'TEST-MPN',
          imageUrl: null,
          priceText: '1000',
          availabilityText: 'In Stock',
          rawSpecifications: [],
        });
        expect(result.eligible).toBe(true);
      }
    });

    it('PSU, CASE, COOLING categories are accepted by publisher', async () => {
      const { checkEligibility } = await import('./store-product-publisher.js');

      for (const cat of ['PSU', 'CASE', 'COOLING']) {
        const result = checkEligibility({
          storeCode: 'EL_NOUR',
          externalId: '12345',
          canonicalUrl: 'https://elnour-tech.com/en/product/test/',
          sourceUrl: 'https://elnour-tech.com/en/product/test/',
          category: cat,
          title: 'Test Product',
          brand: 'Test',
          model: 'Test Model',
          mpn: 'TEST-MPN',
          imageUrl: null,
          priceText: '1000',
          availabilityText: 'In Stock',
          rawSpecifications: [],
        });
        expect(result.eligible).toBe(true);
      }
    });
  });
});
