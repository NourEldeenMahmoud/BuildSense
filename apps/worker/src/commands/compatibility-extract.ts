import {
  CatalogProductRepository,
  CategoryQualityReportRepository,
  compareExtractorVersions,
  migrationDryRun,
  migrationRun,
  migrationVerify,
} from '@buildsense/database';
import type { PersistedFactSet } from '@buildsense/database';
import { createLogger } from '@buildsense/observability';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CompatibilityExtractOptions {
  /** Extract for a single category. Mutually exclusive with `all`. */
  category?: string;
  /** Extract for all supported categories. Mutually exclusive with `category`. */
  all?: boolean;
  /** Report scope without persisting. */
  dryRun?: boolean;
  /** Products per batch (default 100). */
  batchSize?: number;
  /** Resume from this _id (exclusive). */
  resumeFrom?: string;
  /** Override extractor version (for testing). */
  extractorVersion?: string;
  /** Re-extract even if version matches. */
  forceReprocess?: boolean;
  /** Report coverage/precision stats only — no extraction. */
  reportOnly?: boolean;
  /** Run legacy normalization dry-run before extraction. */
  migrateLegacyDryRun?: boolean;
  /** Run legacy normalization before extraction. */
  migrateLegacy?: boolean;
}

// ---------------------------------------------------------------------------
// Summary result
// ---------------------------------------------------------------------------

export type CompatibilityExtractResult =
  | { status: 'dry_run'; summary: ExtractionSummary }
  | { status: 'success'; summary: ExtractionSummary }
  | { status: 'error'; error: string; summary: ExtractionSummary };

export interface ExtractionSummary {
  categories: string[];
  totalScanned: number;
  totalExtracted: number;
  totalUpdated: number;
  totalSkipped: number;
  totalStale: number;
  totalFailed: number;
  lastCheckpointId: string | null;
  elapsedMs: number;
  qualityReports: QualityReportSummary[];
  /** Explicit flag: production representativeness is NOT established until M2 pagination and verified sample. */
  productionRepresentativenessEstablished: boolean;
}

export interface QualityReportSummary {
  category: string;
  extractorVersion: string;
  totalProducts: number;
  allGatesPass: boolean;
  factMetrics: Array<{
    factKey: string;
    coverage: number;
    precision: number | null;
  }>;
}

// ---------------------------------------------------------------------------
// Orchestration service
// ---------------------------------------------------------------------------

const logger = createLogger({ level: 'info', name: 'buildsense' }).child({
  service: 'worker',
  command: 'compatibility-extract',
});

/**
 * Extract compatibility facts for catalog products.
 *
 * Pure orchestration logic — no Commander dependency.
 * Handles batching, idempotent persistence, quality reporting.
 */
export async function runCompatibilityExtract(
  options: CompatibilityExtractOptions = {},
): Promise<CompatibilityExtractResult> {
  const startTime = Date.now();

  const repo = new CatalogProductRepository();
  const qualityRepo = new CategoryQualityReportRepository();

  // Determine categories to process
  const categories = await resolveCategories(options);
  if (categories.length === 0) {
    return {
      status: 'error',
      error: 'No categories specified. Use --category <name> or --all.',
      summary: emptySummary([], startTime),
    };
  }

  // Handle legacy migration if requested
  if (options.migrateLegacyDryRun || options.migrateLegacy) {
    const migrationResult = await handleLegacyMigration(
      options.migrateLegacy ?? false,
      options.batchSize ?? 100,
    );
    logger.info(
      {
        dryRun: !options.migrateLegacy,
        ...migrationResult,
      },
      'Legacy migration completed',
    );
  }

  // Report-only mode: just compute quality reports
  if (options.reportOnly) {
    return runReportOnly(categories, qualityRepo, startTime);
  }

  // Main extraction loop
  const summary = await runExtraction(
    categories,
    repo,
    qualityRepo,
    options,
    startTime,
  );

  if (options.dryRun) {
    return { status: 'dry_run', summary };
  }

  return { status: 'success', summary };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadCompatibilityFacts(): Promise<{
  extractFacts: typeof import('@buildsense/compatibility-facts').extractFacts;
  SUPPORTED_CATEGORIES: typeof import('@buildsense/compatibility-facts').SUPPORTED_CATEGORIES;
  EXTRACTOR_VERSIONS: typeof import('@buildsense/compatibility-facts').EXTRACTOR_VERSIONS;
  EXPECTED_FACT_KEYS: typeof import('@buildsense/compatibility-facts').EXPECTED_FACT_KEYS;
}> {
  return import('@buildsense/compatibility-facts');
}

async function resolveCategories(options: CompatibilityExtractOptions): Promise<string[]> {
  const { SUPPORTED_CATEGORIES } = await loadCompatibilityFacts();
  if (options.all) {
    return [...SUPPORTED_CATEGORIES];
  }
  if (options.category) {
    if (!SUPPORTED_CATEGORIES.includes(options.category)) {
      return [];
    }
    return [options.category];
  }
  return [];
}

function emptySummary(
  categories: string[],
  startTime: number,
): ExtractionSummary {
  return {
    categories,
    totalScanned: 0,
    totalExtracted: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    totalStale: 0,
    totalFailed: 0,
    lastCheckpointId: null,
    elapsedMs: Date.now() - startTime,
    qualityReports: [],
    productionRepresentativenessEstablished: false,
  };
}

async function handleLegacyMigration(
  execute: boolean,
  batchSize: number,
): Promise<{
  wouldNormalize?: number;
  normalized?: number;
  elapsedMs?: number;
  legacyRemaining?: number;
  clean?: boolean;
}> {
  const dryRun = await migrationDryRun();
  logger.info(
    { wouldNormalize: dryRun.wouldNormalize, sampleIds: dryRun.sampleIds },
    'Legacy migration dry-run',
  );

  if (!execute || dryRun.wouldNormalize === 0) {
    return { wouldNormalize: dryRun.wouldNormalize };
  }

  const run = await migrationRun(batchSize);
  const verify = await migrationVerify();
  return {
    normalized: run.normalized,
    elapsedMs: run.elapsedMs,
    legacyRemaining: verify.legacyRemaining,
    clean: verify.clean,
  };
}

async function runExtraction(
  categories: string[],
  repo: CatalogProductRepository,
  qualityRepo: CategoryQualityReportRepository,
  options: CompatibilityExtractOptions,
  startTime: number,
): Promise<ExtractionSummary> {
  const { extractFacts, EXPECTED_FACT_KEYS } = await loadCompatibilityFacts();
  const batchSize = options.batchSize ?? 100;
  const summary: ExtractionSummary = {
    categories,
    totalScanned: 0,
    totalExtracted: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    totalStale: 0,
    totalFailed: 0,
    lastCheckpointId: options.resumeFrom ?? null,
    elapsedMs: 0,
    qualityReports: [],
    productionRepresentativenessEstablished: false,
  };

  // Track extraction stats per category for quality reports
  const categoryStats: Record<string, CategoryExtractionStats> = {};
  for (const cat of categories) {
    categoryStats[cat] = {
      totalProducts: 0,
      factCounts: {},
    };
  }

  for (const category of categories) {
    const extractorVersion = options.extractorVersion
      ?? await getExtractorVersionForCategory(category);
    const persistedCategory = category.toLowerCase();

    logger.info({ category, extractorVersion }, 'Starting extraction');

    let afterId: string | undefined = options.resumeFrom;

    while (true) {
      const batch = await repo.findNeedingExtraction(
        persistedCategory,
        extractorVersion,
        batchSize,
        afterId,
      );

      if (batch.length === 0) break;

      for (const product of batch) {
        summary.totalScanned++;

        try {
          const factSet = extractFacts(
            category,
            product.rawSpecifications ?? [],
          );

          summary.totalExtracted++;
          categoryStats[category]!.totalProducts++;

          // Count fact coverage
          for (const fact of factSet.facts) {
            const existing = categoryStats[category]!.factCounts[fact.key] ?? 0;
            if (fact.value !== null) {
              categoryStats[category]!.factCounts[fact.key] = existing + 1;
            }
          }

          // Dry-run: skip persistence
          if (options.dryRun) {
            summary.totalSkipped++;
            continue;
          }

          // Force reprocess: always write (pass force flag to repository)
          if (options.forceReprocess) {
            const result = await repo.persistFacts(
              String(product._id),
              factSet as PersistedFactSet,
              true, // forceReprocess
            );
            tallyPersistResult(result, summary);
          } else {
            // Version-aware: check if current version is newer
            const currentVersion = product.compatibility?.extractorVersion;
            if (currentVersion && currentVersion !== '' && product.compatibility !== null) {
              const comparison = compareExtractorVersions(extractorVersion, currentVersion);
              // Current version is newer: skip (stale will be returned by persistFacts)
              if (comparison < 0) {
                // Let persistFacts handle the stale detection
                const result = await repo.persistFacts(
                  String(product._id),
                  factSet as PersistedFactSet,
                  false,
                );
                tallyPersistResult(result, summary);
              } else if (comparison === 0) {
                // Same version: skip (idempotent)
                summary.totalSkipped++;
              } else {
                // Newer version: write
                const result = await repo.persistFacts(
                  String(product._id),
                  factSet as PersistedFactSet,
                  false,
                );
                tallyPersistResult(result, summary);
              }
            } else {
              // No current version: write
              const result = await repo.persistFacts(
                String(product._id),
                factSet as PersistedFactSet,
                false,
              );
              tallyPersistResult(result, summary);
            }
          }
        } catch (err) {
          summary.totalFailed++;
          logger.error(
            {
              productId: String(product._id),
              error: err instanceof Error ? err.message : String(err),
            },
            'Product extraction failed',
          );
        }

        summary.lastCheckpointId = String(product._id);
      }

      afterId = String(batch[batch.length - 1]!._id);
    }

    // Generate quality report for this category
    const totalInCategory = await repo.countByCategory(persistedCategory);
    const factStats = computeFactStats(
      categoryStats[category]!,
      EXPECTED_FACT_KEYS[category] ?? [],
    );

    if (!options.dryRun && factStats.length > 0) {
      const report = await qualityRepo.computeAndUpsert(
        category,
        categoryStats[category]!.totalProducts > 0
          ? await getExtractorVersionForCategory(category)
          : 'unknown/0.0.0',
        totalInCategory,
        factStats,
      );

      summary.qualityReports.push({
        category,
        extractorVersion: report.extractorVersion,
        totalProducts: report.totalProducts,
        allGatesPass: report.allGatesPass,
        factMetrics: report.factMetrics.map((m) => ({
          factKey: m.factKey,
          coverage: m.coverage,
          precision: m.precision,
        })),
      });
    }
  }

  summary.elapsedMs = Date.now() - startTime;
  return summary;
}

interface CategoryExtractionStats {
  totalProducts: number;
  factCounts: Record<string, number>;
}

function computeFactStats(
  stats: CategoryExtractionStats,
  expectedKeys: readonly string[],
): Array<{
  factKey: string;
  extractableCount: number;
  verifiedCorrect: number | null;
  verifiedSampleSize: number | null;
}> {
  return expectedKeys.map((key) => ({
    factKey: key,
    extractableCount: stats.factCounts[key] ?? 0,
    verifiedCorrect: null,
    verifiedSampleSize: null,
  }));
}

function tallyPersistResult(
  result: import('@buildsense/database').PersistFactsResult,
  summary: ExtractionSummary,
): void {
  switch (result.kind) {
    case 'updated':
      summary.totalUpdated++;
      break;
    case 'skipped':
      summary.totalSkipped++;
      break;
    case 'stale':
      summary.totalStale++;
      break;
    case 'invalid':
    case 'failed':
      summary.totalFailed++;
      break;
  }
}

async function runReportOnly(
  categories: string[],
  qualityRepo: CategoryQualityReportRepository,
  startTime: number,
): Promise<CompatibilityExtractResult> {
  const summary: ExtractionSummary = {
    categories,
    totalScanned: 0,
    totalExtracted: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    totalStale: 0,
    totalFailed: 0,
    lastCheckpointId: null,
    elapsedMs: 0,
    qualityReports: [],
    productionRepresentativenessEstablished: false,
  };

  for (const category of categories) {
    const report = await qualityRepo.findLatest(category);
    if (report) {
      summary.qualityReports.push({
        category,
        extractorVersion: report.extractorVersion,
        totalProducts: report.totalProducts,
        allGatesPass: report.allGatesPass,
        factMetrics: report.factMetrics.map((m) => ({
          factKey: m.factKey,
          coverage: m.coverage,
          precision: m.precision,
        })),
      });
    }
  }

  summary.elapsedMs = Date.now() - startTime;
  return { status: 'success', summary };
}

async function getExtractorVersionForCategory(category: string): Promise<string> {
  const { EXTRACTOR_VERSIONS } = await loadCompatibilityFacts();
  return EXTRACTOR_VERSIONS[category] ?? 'unknown/0.0.0';
}
