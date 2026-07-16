// ---------------------------------------------------------------------------
// Versioned authoritative reference-data types — pure, zero-infrastructure
// Plan §7.3 / Task P0-3
// ---------------------------------------------------------------------------

/** A chipset/family support entry for CMP-CPU-MB-002. */
export interface ChipsetCpuSupportEntry {
  /** Chipset name (e.g., "B650", "Z790"). */
  readonly chipset: string;
  /** Supported CPU families (e.g., ["Ryzen 7000", "Ryzen 9000"]). */
  readonly supportedFamilies: readonly string[];
  /** CPU families requiring BIOS update to be supported. */
  readonly biosUpdateRequired: readonly string[];
  /** Source URL or citation for this entry. */
  readonly source: string;
  /** When this entry was last verified. ISO-8601. */
  readonly verifiedAt: string;
}

/**
 * Versioned reference dataset.
 *
 * chipsetCpuSupport starts as an empty array — no fabricated support data.
 * CMP-CPU-MB-002 returns UNKNOWN until this dataset has >=1 entry and
 * the quality gate passes.
 */
export interface ReferenceDataset {
  /** Semantic version of the dataset (e.g., "1.0.0"). */
  readonly version: string;
  /** When this version was published. ISO-8601. */
  readonly publishedAt: string;
  /** Chipset -> CPU support mappings. Empty until authoritative source is sourced. */
  readonly chipsetCpuSupport: readonly ChipsetCpuSupportEntry[];
  /** Source citation for the entire dataset. */
  readonly citation: string;
}
