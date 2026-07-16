import { CatalogProductModel } from '../models/catalog-product.js';
import { CatalogProductRepository } from '../repositories/catalog-product-repository.js';

// ---------------------------------------------------------------------------
// Safe migration primitive — Phase 2A
//
// Normalizes legacy `compatibility: {}` to `null` without destructive bulk
// updates.  Supports dry-run mode for Phase 2B planning.
//
// Legacy detection: documents where `compatibility` is non-null but
// `compatibility.extractorVersion` is an empty string — the Phase 0 schema
// default fills `{}` with empty placeholders for required fields.
// ---------------------------------------------------------------------------

export interface MigrationDryRunResult {
  /** Number of documents that would be normalized. */
  wouldNormalize: number;
  /** Sample document IDs (up to 10) for inspection. */
  sampleIds: string[];
}

export interface MigrationRunResult {
  /** Number of documents actually normalized. */
  normalized: number;
  /** Time taken in milliseconds. */
  elapsedMs: number;
}

/**
 * Dry-run: count legacy documents and return sample IDs without modifying
 * anything.  Safe to call against production data.
 */
export async function migrationDryRun(
  limit = 10,
): Promise<MigrationDryRunResult> {
  const repo = new CatalogProductRepository();

  const count = await repo.countLegacyCompatibility();

  // Fetch a small sample for inspection
  const sample = await CatalogProductModel.find({
    'compatibility.extractorVersion': '',
    compatibility: { $ne: null },
  })
    .limit(limit)
    .select({ _id: 1 })
    .lean();

  return {
    wouldNormalize: count,
    sampleIds: sample.map((doc) => String(doc._id)),
  };
}

/**
 * Execute the migration: normalize all legacy `compatibility: {}` documents
 * to `null`.  Processes in batches to avoid locking large collections.
 *
 * Returns the count of normalized documents and elapsed time.
 */
export async function migrationRun(
  batchSize = 100,
): Promise<MigrationRunResult> {
  const repo = new CatalogProductRepository();
  const start = Date.now();

  const normalized = await repo.normalizeLegacyCompatibility(batchSize);

  return {
    normalized,
    elapsedMs: Date.now() - start,
  };
}

/**
 * Verify post-migration: confirm no legacy documents remain.
 */
export async function migrationVerify(): Promise<{
  legacyRemaining: number;
  clean: boolean;
}> {
  const repo = new CatalogProductRepository();
  const remaining = await repo.countLegacyCompatibility();
  return {
    legacyRemaining: remaining,
    clean: remaining === 0,
  };
}
