// ---------------------------------------------------------------------------
// Category quality report types — pure, zero-infrastructure
// Plan §7.2 / Task P0-2
// ---------------------------------------------------------------------------

/** Per-fact quality metrics within a category. */
export interface FactQualityMetrics {
  /** Fact key (e.g., "cpu.socket", "mb.maxMemoryGB"). */
  readonly factKey: string;
  /** Number of products in category where this fact was extracted with value != null. */
  readonly extractableCount: number;
  /** Coverage = extractableCount / totalProductsInCategory. */
  readonly coverage: number;
  /** Number of products in verified sample where fact value was correct. null if not yet verified. */
  readonly verifiedCorrect: number | null;
  /**
   * Total verified sample size for this fact. null if not yet verified.
   * verifiedSampleSize >= 50 or == all products when fewer.
   */
  readonly verifiedSampleSize: number | null;
  /** Precision = verifiedCorrect / verifiedSampleSize. null if not yet verified. */
  readonly precision: number | null;
}

/** Quality report for a category at a specific extractor version. */
export interface CategoryQualityReport {
  /** MongoDB _id (auto-generated). */
  readonly _id?: unknown;
  /** Category name (e.g., "CPU", "Motherboard"). */
  readonly category: string;
  /** Extractor version this report evaluates. */
  readonly extractorVersion: string;
  /** Total products in this category in the catalog. */
  readonly totalProducts: number;
  /** Per-fact metrics. */
  readonly factMetrics: readonly FactQualityMetrics[];
  /** Whether all fact gates pass for this category (coverage >=80%, precision >=95%). */
  readonly allGatesPass: boolean;
  /** When this report was generated. ISO-8601. */
  readonly evaluatedAt: string;
}
