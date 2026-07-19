import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { StoreCode } from '@buildsense/contracts';
import type {
  ScrapeRunRepository,
  ScrapeRunItemRepository,
  RawProductSnapshotRepository,
  DiscoveredProductRepository,
  CatalogProductRepository,
  OfferRepository,
} from '@buildsense/database';
import type { StoreScraperAdapter as ContractsAdapter } from '@buildsense/contracts';
import type { SnapshotStore } from '@buildsense/scraping-core';
import { StoreProductPublisher, resolveCategoryFromBreadcrumbs } from './store-product-publisher.js';

// ---------------------------------------------------------------------------
// Manifest schema
// ---------------------------------------------------------------------------

export interface BrowserCaptureEntry {
  url: string;
  htmlFile: string;
  capturedAt: string;
}

export interface BrowserCaptureManifest {
  entries: BrowserCaptureEntry[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface BrowserCaptureImportConfig {
  storeCode: StoreCode;
  storeHost: string;
  adapter: ContractsAdapter;
  snapshotStore: SnapshotStore;
  runRepository: ScrapeRunRepository;
  itemRepository: ScrapeRunItemRepository;
  snapshotRepository: RawProductSnapshotRepository;
  discoveredProductRepository: DiscoveredProductRepository;
  catalogProductRepository: CatalogProductRepository;
  offerRepository: OfferRepository;
}

export interface BrowserCaptureImportOptions {
  manifestPath: string;
  publish: boolean;
}

// ---------------------------------------------------------------------------
// Per-page result
// ---------------------------------------------------------------------------

export type PageOutcomeKind =
  | 'PARSE_OK_PUBLISHED'
  | 'PARSE_OK_SKIPPED_PUBLISH'
  | 'PARSE_OK_PUBLISH_FAILED'
  | 'PARSE_FAILED'
  | 'VALIDATION_FAILED'
  | 'DUPLICATE_SKIPPED'
  | 'SNAPSHOT_EXISTS';

export interface PageResult {
  url: string;
  htmlFile: string;
  outcome: PageOutcomeKind;
  detail?: string;
  snapshotId?: string;
  productId?: string;
  offerId?: string;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface BrowserCaptureImportResult {
  runId: string;
  totalEntries: number;
  parsed: number;
  parseFailed: number;
  published: number;
  publishSkipped: number;
  publishFailed: number;
  validationFailed: number;
  duplicatesSkipped: number;
  snapshotsExisted: number;
  pages: PageResult[];
}

// ---------------------------------------------------------------------------
// Manifest validation
// ---------------------------------------------------------------------------

export async function loadManifest(manifestPath: string): Promise<BrowserCaptureManifest> {
  const raw = await fs.readFile(manifestPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in manifest: ${manifestPath}`);
  }
  return parsed as BrowserCaptureManifest;
}

export function validateManifest(
  manifest: BrowserCaptureManifest,
  storeHost: string,
): string[] {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return ['Manifest must be a JSON object'];
  }
  if (!Array.isArray(manifest.entries)) {
    return ['Manifest.entries must be an array'];
  }
  if (manifest.entries.length === 0) {
    return ['Manifest.entries must not be empty'];
  }
  if (manifest.entries.length > 10_000) {
    errors.push('Manifest.entries must not exceed 10,000 items');
  }

  const urls = new Set<string>();

  for (let i = 0; i < manifest.entries.length; i++) {
    const entry = manifest.entries[i]!;
    const prefix = `entries[${i}]`;

    if (!entry || typeof entry !== 'object') {
      errors.push(`${prefix}: entry must be an object`);
      continue;
    }

    if (typeof entry.url !== 'string' || entry.url.trim().length === 0) {
      errors.push(`${prefix}: url is required and must be a non-empty string`);
    } else {
      try {
        const parsed = new URL(entry.url);
        if (parsed.hostname !== storeHost) {
          errors.push(`${prefix}: url hostname "${parsed.hostname}" does not match expected "${storeHost}"`);
        }
      } catch {
        errors.push(`${prefix}: url is not a valid URL`);
      }
      if (urls.has(entry.url)) {
        errors.push(`${prefix}: duplicate URL "${entry.url}"`);
      }
      urls.add(entry.url);
    }

    if (typeof entry.htmlFile !== 'string' || entry.htmlFile.trim().length === 0) {
      errors.push(`${prefix}: htmlFile is required and must be a non-empty string`);
    }

    if (typeof entry.capturedAt !== 'string' || entry.capturedAt.trim().length === 0) {
      errors.push(`${prefix}: capturedAt is required and must be a non-empty string`);
    } else if (Number.isNaN(Date.parse(entry.capturedAt))) {
      errors.push(`${prefix}: capturedAt is not a valid ISO 8601 timestamp`);
    }
  }

  return errors;
}

export function resolveHtmlPath(manifestDir: string, htmlFile: string): string {
  // Resolve both to absolute platform-native paths so the startsWith check works on Windows
  const resolvedManifestDir = path.resolve(manifestDir);
  const resolved = path.resolve(resolvedManifestDir, htmlFile);
  // Ensure the resolved path is within the manifest directory
  if (!resolved.startsWith(resolvedManifestDir)) {
    throw new Error(`htmlFile "${htmlFile}" escapes manifest directory`);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Run ID generation (deterministic from manifest content)
// ---------------------------------------------------------------------------

function computeManifestHash(manifest: BrowserCaptureManifest): string {
  const canonical = JSON.stringify(
    manifest.entries.map((e) => ({
      url: e.url,
      htmlFile: e.htmlFile,
      capturedAt: e.capturedAt,
    })),
  );
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

export async function executeBrowserCaptureImport(
  config: BrowserCaptureImportConfig,
  options: BrowserCaptureImportOptions,
): Promise<BrowserCaptureImportResult> {
  const manifestDir = path.resolve(path.dirname(options.manifestPath));
  const manifest = await loadManifest(options.manifestPath);
  const errors = validateManifest(manifest, config.storeHost);
  if (errors.length > 0) {
    throw new Error(`Manifest validation failed:\n${errors.join('\n')}`);
  }

  // Deterministic run ID based on manifest content
  const runHash = computeManifestHash(manifest);
  const runId = `browser-capture-${config.storeCode.toLowerCase()}-${runHash}`;

  // Check for existing completed run with same ID (idempotent rerun)
  const existingRun = await config.runRepository.findByRunId(runId, config.storeCode);
  let scrapeRun;
  if (existingRun && (existingRun.status === 'SUCCEEDED' || existingRun.status === 'PARTIALLY_FAILED')) {
    scrapeRun = existingRun;
  } else if (existingRun) {
    // Terminal or running — reuse
    scrapeRun = existingRun;
  } else {
    scrapeRun = await config.runRepository.create({
      storeCode: config.storeCode,
      runId,
      mode: 'URL',
      commandInput: JSON.stringify({
        mode: 'BROWSER_CAPTURE_IMPORT',
        manifestPath: path.resolve(options.manifestPath),
      }),
    });
    await config.runRepository.updateByRunId(runId, {
      status: 'RUNNING',
      stage: 'FETCH',
      startedAt: new Date(),
    }, config.storeCode);
  }

  const pages: PageResult[] = [];
  let parsed = 0;
  let parseFailed = 0;
  let published = 0;
  let publishSkipped = 0;
  let publishFailed = 0;
  let validationFailed = 0;
  let duplicatesSkipped = 0;
  let snapshotsExisted = 0;

  // Optional publisher
  let publisher: StoreProductPublisher | undefined;
  if (options.publish) {
    publisher = new StoreProductPublisher({
      catalogProductRepository: config.catalogProductRepository,
      offerRepository: config.offerRepository,
      snapshotRepository: config.snapshotRepository,
    });
  }

  for (let i = 0; i < manifest.entries.length; i++) {
    const entry = manifest.entries[i]!;
    const entryErrors = validateSingleEntry(entry, storeHostForEntry(config, entry));
    if (entryErrors.length > 0) {
      validationFailed++;
      pages.push({
        url: entry.url,
        htmlFile: entry.htmlFile,
        outcome: 'VALIDATION_FAILED',
        detail: entryErrors.join('; '),
      });
      continue;
    }

    let html: string;
    try {
      const htmlPath = resolveHtmlPath(manifestDir, entry.htmlFile);
      html = await fs.readFile(htmlPath, 'utf-8');
    } catch (err) {
      validationFailed++;
      pages.push({
        url: entry.url,
        htmlFile: entry.htmlFile,
        outcome: 'VALIDATION_FAILED',
        detail: `Cannot read HTML file: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    // Create run item (idempotent by canonicalUrl within this run)
    const item = await config.itemRepository.upsert({
      scrapeRunId: scrapeRun._id,
      canonicalUrl: entry.url,
    });

    // Check if this URL was already fetched in this run
    if (item.fetchState === 'FETCHED' && item.snapshotId) {
      duplicatesSkipped++;
      pages.push({
        url: entry.url,
        htmlFile: entry.htmlFile,
        outcome: 'DUPLICATE_SKIPPED',
        detail: 'Already processed in this run',
        snapshotId: item.snapshotId.toString(),
      });
      continue;
    }

    // Parse through adapter
    let parsedResult;
    try {
      parsedResult = await config.adapter.parseProductPage({
        url: entry.url,
        html,
        scrapeRunId: runId,
      });
    } catch (err) {
      parseFailed++;
      await config.itemRepository.updateByCanonicalUrl(scrapeRun._id, entry.url, {
        fetchState: 'FAILED',
        attempts: item.attempts + 1,
        failureKind: 'PARSE_FAILED',
      });
      pages.push({
        url: entry.url,
        htmlFile: entry.htmlFile,
        outcome: 'PARSE_FAILED',
        detail: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    // Write snapshot to disk
    const writeResult = await config.snapshotStore.writeSnapshot({
      runId: scrapeRun._id.toString(),
      externalId: parsedResult.externalId,
      canonicalUrl: parsedResult.canonicalUrl,
      content: Buffer.from(html),
    });

    // Check for existing snapshot by content hash in this run
    const existingSnapshot = await config.snapshotRepository.findByContentSha256(
      writeResult.contentSha256,
      scrapeRun._id,
    );

    let snapshot;
    if (existingSnapshot) {
      snapshot = existingSnapshot;
      snapshotsExisted++;
    } else {
      snapshot = await config.snapshotRepository.insert({
        storeCode: config.storeCode,
        externalId: parsedResult.externalId,
        canonicalUrl: parsedResult.canonicalUrl,
        sourceUrl: parsedResult.sourceUrl,
        scrapeRunId: scrapeRun._id,
        fetchedAt: new Date(entry.capturedAt),
        httpStatus: 200,
        responseContentType: 'text/html',
        contentSha256: writeResult.contentSha256,
        contentStorage: 'FILE',
        contentPath: writeResult.contentPath,
        parserVersion: config.adapter.parserVersion,
        parseStatus: parsedResult.raw.title !== null ? 'OK' : 'FAILED',
        raw: parsedResult.raw,
        parseWarnings: [
          ...parsedResult.warnings,
          `BROWSER_CAPTURE_IMPORT: captured at ${entry.capturedAt}`,
        ],
      });
    }

    // Update item
    await config.itemRepository.updateByCanonicalUrl(scrapeRun._id, entry.url, {
      fetchState: 'FETCHED',
      attempts: item.attempts + 1,
      snapshotId: snapshot._id,
    });

    // Upsert discovered product
    await config.discoveredProductRepository.upsert({
      storeCode: config.storeCode,
      canonicalUrl: entry.url,
      scrapeRunId: scrapeRun._id,
      ...(parsedResult.externalId !== null && { externalId: parsedResult.externalId }),
    });

    parsed++;

    // Publish if requested and snapshot is OK
    if (publisher && snapshot.parseStatus === 'OK' && parsedResult.raw.title) {
      const category = resolveCategoryFromBreadcrumbs(
        parsedResult.raw.breadcrumbs,
        'UNCATEGORIZED',
      );
      const publishResult = await publisher.publish({
        storeCode: config.storeCode,
        externalId: parsedResult.externalId ?? '',
        canonicalUrl: parsedResult.canonicalUrl,
        sourceUrl: parsedResult.sourceUrl,
        category,
        title: parsedResult.raw.title,
        brand: parsedResult.raw.brandText ?? null,
        model: parsedResult.raw.modelText ?? null,
        mpn: parsedResult.raw.partNumberText ?? null,
        imageUrl: parsedResult.raw.imageUrls[0] ?? null,
        priceText: parsedResult.raw.priceText ?? null,
        availabilityText: parsedResult.raw.availabilityText ?? null,
        rawSpecifications: parsedResult.raw.specifications,
      });

      if (
        publishResult.kind === 'PUBLISHED_NEW_PRODUCT' ||
        publishResult.kind === 'PUBLISHED_ADDED_OFFER' ||
        publishResult.kind === 'PUBLISHED_UPDATED_OFFER'
      ) {
        published++;
        pages.push({
          url: entry.url,
          htmlFile: entry.htmlFile,
          outcome: 'PARSE_OK_PUBLISHED',
          detail: `${publishResult.kind}: ${publishResult.reason}`,
          snapshotId: snapshot._id.toString(),
          ...(publishResult.productId !== undefined && { productId: publishResult.productId }),
          ...(publishResult.offerId !== undefined && { offerId: publishResult.offerId }),
        });
      } else {
        publishSkipped++;
        pages.push({
          url: entry.url,
          htmlFile: entry.htmlFile,
          outcome: 'PARSE_OK_SKIPPED_PUBLISH',
          detail: `${publishResult.kind}: ${publishResult.reason}`,
          snapshotId: snapshot._id.toString(),
        });
      }
    } else if (publisher && snapshot.parseStatus !== 'OK') {
      publishSkipped++;
      pages.push({
        url: entry.url,
        htmlFile: entry.htmlFile,
        outcome: 'PARSE_OK_SKIPPED_PUBLISH',
        detail: 'Snapshot parseStatus is FAILED — raw preserved, not published',
        snapshotId: snapshot._id.toString(),
      });
    } else {
      publishSkipped++;
      pages.push({
        url: entry.url,
        htmlFile: entry.htmlFile,
        outcome: 'PARSE_OK_SKIPPED_PUBLISH',
        detail: 'Publish not requested',
        snapshotId: snapshot._id.toString(),
      });
    }
  }

  // Finalize run
  const totalFailed = validationFailed + parseFailed;
  const status = totalFailed > 0 ? 'PARTIALLY_FAILED' : 'SUCCEEDED';
  await config.runRepository.updateByRunId(runId, {
    status,
    stage: 'FETCH',
    summary: {
      totalDiscovered: manifest.entries.length,
      totalFetched: parsed,
      totalFailed,
    },
    completedAt: new Date(),
  }, config.storeCode);

  return {
    runId,
    totalEntries: manifest.entries.length,
    parsed,
    parseFailed,
    published,
    publishSkipped,
    publishFailed,
    validationFailed,
    duplicatesSkipped,
    snapshotsExisted,
    pages,
  };
}

function storeHostForEntry(config: BrowserCaptureImportConfig, _entry: BrowserCaptureEntry): string {
  return config.storeHost;
}

function validateSingleEntry(entry: BrowserCaptureEntry, storeHost: string): string[] {
  const errors: string[] = [];
  if (typeof entry.url !== 'string' || entry.url.trim().length === 0) {
    errors.push('url is required');
  } else {
    try {
      const parsed = new URL(entry.url);
      if (parsed.hostname !== storeHost) {
        errors.push(`url hostname "${parsed.hostname}" does not match expected "${storeHost}"`);
      }
    } catch {
      errors.push('url is not a valid URL');
    }
  }
  if (typeof entry.htmlFile !== 'string' || entry.htmlFile.trim().length === 0) {
    errors.push('htmlFile is required');
  }
  if (typeof entry.capturedAt !== 'string' || entry.capturedAt.trim().length === 0) {
    errors.push('capturedAt is required');
  } else if (Number.isNaN(Date.parse(entry.capturedAt))) {
    errors.push('capturedAt is not a valid ISO 8601 timestamp');
  }
  return errors;
}
