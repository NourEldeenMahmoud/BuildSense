import { CatalogProductModel, type CatalogProductDocument } from '../models/catalog-product.js';

// ---------------------------------------------------------------------------
// Version comparison utilities
// ---------------------------------------------------------------------------

/**
 * Parse an extractor version string like "cpu/v1.0.0" into a comparable form.
 * Returns [category, major, minor, patch] or null if malformed.
 */
export function parseExtractorVersion(version: string): [string, number, number, number] | null {
  const match = version.match(/^([a-z]+)\/v(\d+)\.(\d+)\.(\d+)$/i);
  if (!match) return null;
  return [match[1]!, parseInt(match[2]!, 10), parseInt(match[3]!, 10), parseInt(match[4]!, 10)];
}

/**
 * Compare two extractor versions. Returns:
 * - negative if a < b (older)
 * - 0 if a === b (same)
 * - positive if a > b (newer)
 *
 * Categories must match; returns 0 for same-category comparison,
 * or NaN-like behavior is avoided by returning 0 for mismatched categories
 * (caller should check category match separately).
 */
export function compareExtractorVersions(a: string, b: string): number {
  const parsedA = parseExtractorVersion(a);
  const parsedB = parseExtractorVersion(b);

  if (!parsedA || !parsedB) return 0;

  const [catA, majorA, minorA, patchA] = parsedA;
  const [catB, majorB, minorB, patchB] = parsedB;

  // Different categories: cannot compare (return 0, caller must handle)
  if (catA !== catB) return 0;

  // Compare major.minor.patch
  if (majorA !== majorB) return majorA - majorB;
  if (minorA !== minorB) return minorA - minorB;
  return patchA - patchB;
}

// ---------------------------------------------------------------------------
// Input / result types
// ---------------------------------------------------------------------------

/** Compatibility fact set shape matching CatalogProduct.compatibility subdocument. */
export interface CompatibilityFactSet {
  category: string;
  extractorVersion: string;
  facts: Array<{
    key: string;
    value: unknown;
    evidence: Array<{
      sourceLabel: string;
      rawValue: string;
      normalizedValue: string | null;
      confidence: number;
      extractorVersion: string;
      extractionIssues: string[];
    }>;
  }>;
  extractedAt: string;
  extractionIssues: string[];
}

/** Result of persisting compatibility facts on a single product. */
export type PersistFactsResult =
  | { kind: 'updated'; productId: string }
  | { kind: 'skipped'; productId: string; reason: 'same_version' | 'not_found' }
  | { kind: 'stale'; productId: string; currentVersion: string }
  | { kind: 'invalid'; productId: string; reason: string }
  | { kind: 'failed'; productId: string; error: string };

/** Options for batch iteration. */
export interface IterateBatchOptions {
  /** Filter by product category. */
  category?: string;
  /** Maximum products per batch. */
  batchSize: number;
  /** Resume from this _id (exclusive). Products with _id > cursor are returned. */
  afterId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class CatalogProductRepository {
  /**
   * Iterate eligible CatalogProducts in stable `_id` order with cursor-based
   * pagination.  Returns up to `batchSize` documents.  Pass the last item's
   * `_id` as `afterId` on the next call to advance through the catalog.
   *
   * Ordering is deterministic (`_id` asc) so resuming from a checkpoint
   * never re-visits or skips documents.
   */
  async iterateBatch(options: IterateBatchOptions): Promise<CatalogProductDocument[]> {
    const filter: Record<string, unknown> = {};
    if (options.category) {
      filter.category = options.category;
    }
    if (options.afterId) {
      filter._id = { $gt: options.afterId };
    }

    return CatalogProductModel.find(filter)
      .sort({ _id: 1 })
      .limit(options.batchSize)
      .lean() as unknown as Promise<CatalogProductDocument[]>;
  }

  /**
   * Find products in a category whose `compatibility` is either `null` or
   * has a different `extractorVersion` than the supplied version.  Used by
   * the worker to identify products needing (re-)extraction.
   *
   * Returns a cursor-compatible array ordered by `_id` for batch processing.
   */
  async findNeedingExtraction(
    category: string,
    extractorVersion: string,
    batchSize: number,
    afterId?: string,
  ): Promise<CatalogProductDocument[]> {
    const filter: Record<string, unknown> = {
      category,
      $or: [
        { compatibility: null },
        { 'compatibility.extractorVersion': { $ne: extractorVersion } },
        { 'compatibility.extractorVersion': '' },
      ],
    };

    if (afterId) {
      filter._id = { $gt: afterId };
    }

    return CatalogProductModel.find(filter)
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean() as unknown as Promise<CatalogProductDocument[]>;
  }

  /**
   * Find products with legacy empty-object `compatibility: {}`.
   *
   * The Phase 0 schema defaults fill `{}` with empty string placeholders
   * for required fields.  This query detects documents where the
   * `extractorVersion` is an empty string — the signature of an
   * un-extracted or legacy-normalized document.
   */
  async findLegacyCompatibility(
    batchSize: number,
    afterId?: string,
  ): Promise<CatalogProductDocument[]> {
    const filter: Record<string, unknown> = {
      'compatibility.extractorVersion': '',
      compatibility: { $ne: null },
    };

    if (afterId) {
      filter._id = { $gt: afterId };
    }

    return CatalogProductModel.find(filter)
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean() as unknown as Promise<CatalogProductDocument[]>;
  }

  /**
   * Atomically write a CompatibilityFactSet to a product's `compatibility`
   * field.  Version-aware: the write succeeds only if the existing document
   * has either `null` compatibility OR a newer or same version.
   * Writing the same version overwrites (idempotent re-run).
   * Writing an older version overwrites a newer version returns `stale`.
   *
   * rawSpecifications is never modified.
   *
   * Returns a discriminated result for worker tallying.
   */
  async persistFacts(
    productId: string,
    factSet: CompatibilityFactSet,
    forceReprocess = false,
  ): Promise<PersistFactsResult> {
    try {
      // ── Validation: incoming factSet must be well-formed ──────────────
      const incomingParsed = parseExtractorVersion(factSet.extractorVersion);
      if (!incomingParsed) {
        return { kind: 'invalid', productId, reason: 'malformed_incoming_version' };
      }

      // FactSet.category must match the category prefix in extractorVersion (case-insensitive)
      const [incomingCategory] = incomingParsed;
      if (incomingCategory.toLowerCase() !== factSet.category.toLowerCase()) {
        return { kind: 'invalid', productId, reason: 'factset_category_mismatch' };
      }

      // Fetch current document
      const current = await CatalogProductModel.findById(productId).lean();

      if (!current) {
        return { kind: 'skipped', productId, reason: 'not_found' };
      }

      // Product.category must match factSet.category (case-insensitive)
      if (current.category.toLowerCase() !== factSet.category.toLowerCase()) {
        return { kind: 'invalid', productId, reason: 'product_category_mismatch' };
      }

      const currentVersion = current.compatibility?.extractorVersion;
      const newVersion = factSet.extractorVersion;

      // If current has a stored version, validate and compare
      if (currentVersion && currentVersion !== '' && current.compatibility !== null) {
        const storedParsed = parseExtractorVersion(currentVersion);

        // Stored version is malformed or category doesn't match product — reject
        if (!storedParsed || storedParsed[0]!.toLowerCase() !== current.category.toLowerCase()) {
          return { kind: 'invalid', productId, reason: 'stored_version_invalid' };
        }

        const comparison = compareExtractorVersions(newVersion, currentVersion);

        // New version is older than current: always stale (force cannot downgrade)
        if (comparison < 0) {
          return { kind: 'stale', productId, currentVersion };
        }

        // Same version and not force: idempotent skip
        if (comparison === 0 && !forceReprocess) {
          return { kind: 'skipped', productId, reason: 'same_version' };
        }

        // New version is newer (comparison > 0) or same version with force: proceed with write
      }

      // Perform the write
      const updated = await CatalogProductModel.findOneAndUpdate(
        { _id: productId },
        { $set: { compatibility: factSet } },
        { new: true },
      );

      if (!updated) {
        return { kind: 'skipped', productId, reason: 'not_found' };
      }

      return { kind: 'updated', productId };
    } catch (err) {
      return {
        kind: 'failed',
        productId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Normalize a legacy empty-object `compatibility: {}` to `null`.
   *
   * This is a safe, non-destructive operation: it sets `compatibility` to
   * `null` only when `compatibility.extractorVersion` is an empty string
   * (the signature of a legacy or Phase-0-defaulted document).
   *
   * Returns the count of normalized documents.
   */
  async normalizeLegacyCompatibility(batchSize = 100): Promise<number> {
    let totalNormalized = 0;
    let afterId: string | undefined;

    while (true) {
      const batch = await this.findLegacyCompatibility(batchSize, afterId);
      if (batch.length === 0) break;

      const ids = batch.map((doc) => doc._id);
      await CatalogProductModel.updateMany(
        { _id: { $in: ids } },
        { $set: { compatibility: null } },
      );

      totalNormalized += batch.length;
      afterId = String(ids[ids.length - 1]);
    }

    return totalNormalized;
  }

  /**
   * Dry-run version of normalizeLegacyCompatibility — counts how many
   * documents would be normalized without modifying them.
   */
  async countLegacyCompatibility(): Promise<number> {
    return CatalogProductModel.countDocuments({
      'compatibility.extractorVersion': '',
      compatibility: { $ne: null },
    });
  }

  /**
   * Count products in a category.
   */
  async countByCategory(category: string): Promise<number> {
    return CatalogProductModel.countDocuments({ category });
  }

  /**
   * Count products in a category that have a non-null, extracted
   * compatibility fact set (extractorVersion is non-empty).
   */
  async countExtracted(category: string): Promise<number> {
    return CatalogProductModel.countDocuments({
      category,
      'compatibility.extractorVersion': { $ne: '' },
      compatibility: { $ne: null },
    });
  }

  /**
   * Fetch a product by its _id.
   */
  async findById(productId: string): Promise<CatalogProductDocument | null> {
    return CatalogProductModel.findById(productId);
  }
}
