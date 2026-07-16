// ---------------------------------------------------------------------------
// Compatibility fact types — pure, zero-infrastructure
// Plan §7.1 / Task P0-1
// ---------------------------------------------------------------------------

/** Per-fact evidence captured at extraction time. */
export interface FactEvidence {
  /** Source spec label from rawSpecifications (e.g., "Socket", "Memory Type"). */
  readonly sourceLabel: string;
  /** Raw string value from rawSpecifications before normalization. */
  readonly rawValue: string;
  /** Normalized value after alias/unit resolution (e.g., "AM5", "DDR5"). */
  readonly normalizedValue: string | null;
  /** 0.0–1.0 confidence in the extraction for this fact. */
  readonly confidence: number;
  /** Human-readable extractor version that produced this evidence. */
  readonly extractorVersion: string;
  /** Issues encountered during extraction (e.g., ambiguous label, unit mismatch). Empty array = clean. */
  readonly extractionIssues: readonly string[];
}

/** A single extracted compatibility fact with its evidence chain. */
export interface CompatibilityFact {
  /** Fact key, e.g. "cpu.socket", "mb.socket", "mb.maxMemoryGB". */
  readonly key: string;
  /** Typed value. null means explicitly absent/unknown — never guessed. */
  readonly value: unknown;
  /** Evidence for this specific fact. At least one entry per extracted fact. */
  readonly evidence: readonly FactEvidence[];
}

/**
 * Complete compatibility fact set for a single CatalogProduct.
 * Stored on CatalogProduct.compatibility as a typed document.
 *
 * A product has one CompatibilityFactSet per relevant category.
 * Fact absence is explicit: value null with empty or diagnostic extractionIssues.
 */
export interface CompatibilityFactSet {
  /** Category scope (e.g., "CPU", "Motherboard"). One fact set per category. */
  readonly category: string;
  /** Semantic version of the extractor that produced this fact set. */
  readonly extractorVersion: string;
  /** All extracted facts for this product. Empty array = extraction ran but found nothing. */
  readonly facts: readonly CompatibilityFact[];
  /** When extraction ran. ISO-8601. */
  readonly extractedAt: string;
  /** Top-level issues from the extraction pass (e.g., "no specifications found"). */
  readonly extractionIssues: readonly string[];
}
