// ---------------------------------------------------------------------------
// Category dispatcher — routes raw specs to the correct extractor
// ---------------------------------------------------------------------------

import type { CompatibilityFactSet } from '@buildsense/domain';
import type { SpecEntry } from './types.js';
import { EXTRACTOR_VERSIONS } from './types.js';
import { extractCpuFacts } from './extractors/cpu.js';
import { extractMotherboardFacts } from './extractors/motherboard.js';
import { extractRamFacts } from './extractors/ram.js';
import { extractGpuFacts } from './extractors/gpu.js';
import { extractStorageFacts } from './extractors/storage.js';
import { extractPsuFacts } from './extractors/psu.js';
import { extractCaseFacts } from './extractors/case.js';
import { buildFactSet } from './helpers.js';

const EXTRACTORS: Record<
  string,
  (rawSpecs: readonly SpecEntry[], version?: string) => CompatibilityFactSet
> = {
  CPU: extractCpuFacts,
  Motherboard: extractMotherboardFacts,
  RAM: extractRamFacts,
  GPU: extractGpuFacts,
  Storage: extractStorageFacts,
  PSU: extractPsuFacts,
  Case: extractCaseFacts,
};

/**
 * Extract compatibility facts for a given category from raw specifications.
 * Returns a CompatibilityFactSet with extractionIssues if the category is unknown.
 */
export function extractFacts(
  category: string,
  rawSpecs: readonly SpecEntry[],
): CompatibilityFactSet {
  const extractor = EXTRACTORS[category];
  if (!extractor) {
    return buildFactSet(
      category,
      'unknown/0.0.0',
      [],
      [`Unknown category: "${category}"`],
    );
  }
  return extractor(rawSpecs);
}

/** All categories supported by the dispatcher. */
export const SUPPORTED_CATEGORIES: readonly string[] =
  Object.keys(EXTRACTORS);

/** Check if a category is supported. */
export function isSupportedCategory(category: string): boolean {
  return category in EXTRACTORS;
}

/** Get the extractor version for a category. */
export function getExtractorVersion(category: string): string | undefined {
  return EXTRACTOR_VERSIONS[category];
}
