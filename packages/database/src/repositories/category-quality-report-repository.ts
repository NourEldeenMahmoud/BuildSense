import {
  CategoryQualityReportModel,
  type CategoryQualityReportDocument,
  type FactQualityMetrics,
} from '../models/category-quality-report.js';

// ---------------------------------------------------------------------------
// Input / result types
// ---------------------------------------------------------------------------

/** Gate evaluation outcome for a single fact. */
export interface FactGateResult {
  factKey: string;
  coverage: number;
  /** null when not enough verified data to compute precision. */
  precision: number | null;
  /** True only when coverage, verified precision, and verified sample all pass. */
  passes: boolean;
  /** Human-readable reason when gate fails. Empty string when passes. */
  failReason: string;
}

/** Upsert input for a quality report. */
export interface UpsertQualityReportInput {
  category: string;
  extractorVersion: string;
  totalProducts: number;
  factMetrics: FactQualityMetrics[];
  /** Pre-computed allGatesPass flag — the repository stores it as-is. */
  allGatesPass: boolean;
}

/** Per-fact quality data collected from a batch of extraction results. */
export interface FactExtractionStats {
  factKey: string;
  /** Number of products where this fact was extracted with value != null. */
  extractableCount: number;
  /** Verified correct count (null if not verified). */
  verifiedCorrect: number | null;
  /** Verified sample size (null if not verified). */
  verifiedSampleSize: number | null;
}

// ---------------------------------------------------------------------------
// Gate thresholds (plan §7.2 / §5 decision)
// ---------------------------------------------------------------------------

const COVERAGE_GATE = 0.80;
const PRECISION_GATE = 0.95;
const MIN_VERIFIED_SAMPLE = 50;

/**
 * Evaluate a single fact's quality gate.
 *
 * Coverage >= 80% AND precision >= 95% (or null = not yet verified).
 * When verifiedSampleSize is non-null but < 50 and < totalProducts,
 * precision is treated as insufficient (gate fails).
 */
export function evaluateFactGate(
  stats: FactExtractionStats,
  totalProducts: number,
): FactGateResult {
  const coverage = totalProducts > 0 ? stats.extractableCount / totalProducts : 0;

  let precision: number | null = null;
  let passes = false;
  let failReason: string;

  if (coverage < COVERAGE_GATE) {
    failReason = `coverage ${(coverage * 100).toFixed(1)}% below threshold ${(COVERAGE_GATE * 100).toFixed(1)}%`;
  } else if (stats.verifiedCorrect === null || stats.verifiedSampleSize === null) {
    failReason = 'verified precision and sample are unavailable';
  } else {
    precision = stats.verifiedSampleSize > 0
      ? stats.verifiedCorrect / stats.verifiedSampleSize
      : 0;
    const sampleSufficient =
      stats.verifiedSampleSize >= MIN_VERIFIED_SAMPLE ||
      stats.verifiedSampleSize >= totalProducts;

    if (!sampleSufficient) {
      failReason = `verified sample ${stats.verifiedSampleSize} below minimum ${MIN_VERIFIED_SAMPLE}`;
    } else if (precision < PRECISION_GATE) {
      failReason = `precision ${(precision * 100).toFixed(1)}% below threshold ${(PRECISION_GATE * 100).toFixed(1)}%`;
    } else {
      passes = true;
      failReason = '';
    }
  }

  return { factKey: stats.factKey, coverage, precision, passes, failReason };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class CategoryQualityReportRepository {
  /**
   * Upsert a quality report by (category, extractorVersion).
   *
   * Idempotent: re-running with the same key overwrites the previous report.
   * A newer extractor version creates a separate document (compound unique
   * index ensures version isolation).
   */
  async upsert(input: UpsertQualityReportInput): Promise<CategoryQualityReportDocument> {
    const result = await CategoryQualityReportModel.findOneAndUpdate(
      {
        category: input.category,
        extractorVersion: input.extractorVersion,
      },
      {
        $set: {
          totalProducts: input.totalProducts,
          factMetrics: input.factMetrics,
          allGatesPass: input.allGatesPass,
          evaluatedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
      },
    );

    return result as CategoryQualityReportDocument;
  }

  /**
   * Find a quality report by (category, extractorVersion).
   */
  async findByCategoryAndVersion(
    category: string,
    extractorVersion: string,
  ): Promise<CategoryQualityReportDocument | null> {
    return CategoryQualityReportModel.findOne({
      category,
      extractorVersion,
    });
  }

  /**
   * Find the latest quality report for a category (any extractor version).
   * Returns the most recently evaluated report.
   */
  async findLatest(category: string): Promise<CategoryQualityReportDocument | null> {
    return CategoryQualityReportModel.findOne({ category })
      .sort({ evaluatedAt: -1 });
  }

  /**
   * Find all quality reports for a category.
   */
  async findAllByCategory(category: string): Promise<CategoryQualityReportDocument[]> {
    return CategoryQualityReportModel.find({ category })
      .sort({ evaluatedAt: -1 });
  }

  /**
   * Evaluate and upsert a quality report from raw extraction stats.
   *
   * This is the high-level method that worker backfill calls after
   * collecting extraction stats across all products in a category.
   * It computes per-fact coverage/precision, evaluates gates, and
   * persists the report atomically via upsert.
   */
  async computeAndUpsert(
    category: string,
    extractorVersion: string,
    totalProducts: number,
    factStats: FactExtractionStats[],
  ): Promise<CategoryQualityReportDocument> {
    const factMetrics: FactQualityMetrics[] = factStats.map((stat) => {
      const gate = evaluateFactGate(stat, totalProducts);
      return {
        factKey: stat.factKey,
        extractableCount: stat.extractableCount,
        coverage: gate.coverage,
        verifiedCorrect: stat.verifiedCorrect,
        verifiedSampleSize: stat.verifiedSampleSize,
        precision: gate.precision,
      };
    });

    // All gates pass only when every fact's gate passes
    const allGatesPass = factMetrics.length > 0 &&
      factStats.every((stat) => evaluateFactGate(stat, totalProducts).passes);

    return this.upsert({
      category,
      extractorVersion,
      totalProducts,
      factMetrics,
      allGatesPass,
    });
  }

  /**
   * Check whether a category's quality gate passes for a specific fact key.
   * Returns false if no report exists.
   */
  async isFactGatePassing(
    category: string,
    extractorVersion: string,
    factKey: string,
  ): Promise<boolean> {
    const report = await this.findByCategoryAndVersion(category, extractorVersion);
    if (!report) return false;

    const metric = report.factMetrics.find((m) => m.factKey === factKey);
    if (!metric) return false;

    const gate = evaluateFactGate(
      {
        factKey: metric.factKey,
        extractableCount: metric.extractableCount,
        verifiedCorrect: metric.verifiedCorrect,
        verifiedSampleSize: metric.verifiedSampleSize,
      },
      report.totalProducts,
    );

    return gate.passes;
  }

  /**
   * Delete all quality reports for a category (rollback helper).
   */
  async deleteByCategory(category: string): Promise<number> {
    const result = await CategoryQualityReportModel.deleteMany({ category });
    return result.deletedCount ?? 0;
  }
}
