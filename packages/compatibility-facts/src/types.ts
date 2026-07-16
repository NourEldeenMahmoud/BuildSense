// ---------------------------------------------------------------------------
// Compatibility-facts package types — pure, zero-infrastructure
// ---------------------------------------------------------------------------

import type { CompatibilityFactSet } from '@buildsense/domain';

/** A single raw specification entry from CatalogProduct.rawSpecifications. */
export type SpecEntry = { readonly label: string; readonly value: string };

/** Extractor version constants per category. */
export const EXTRACTOR_VERSIONS: Record<string, string> = {
  CPU: 'cpu/v1.0.0',
  Motherboard: 'mb/v1.0.0',
  RAM: 'ram/v1.0.0',
  GPU: 'gpu/v1.0.0',
  Storage: 'storage/v1.0.0',
  PSU: 'psu/v1.0.0',
  Case: 'case/v1.0.0',
};

/** All supported categories. */
export const SUPPORTED_CATEGORIES: readonly string[] = Object.keys(EXTRACTOR_VERSIONS);

// ---------------------------------------------------------------------------
// Expected fact keys — centralized, versioned with extractors
// Plan §7.1 / 31 total keys across 7 categories
// ---------------------------------------------------------------------------

export const EXPECTED_FACT_KEYS: Record<string, readonly string[]> = {
  CPU: ['cpu.socket', 'cpu.family', 'cpu.iGpu', 'cpu.tdpWatts'],
  Motherboard: [
    'mb.socket',
    'mb.chipset',
    'mb.formFactor',
    'mb.ramGeneration',
    'mb.ramType',
    'mb.dimmSlots',
    'mb.maxMemoryGB',
    'mb.maxMemorySpeedMHz',
    'mb.sataPorts',
    'mb.m2Slots',
    'mb.m2FormFactors',
  ],
  RAM: ['ram.generation', 'ram.moduleType', 'ram.moduleCount', 'ram.capacityGB', 'ram.speedMHz'],
  GPU: ['gpu.lengthMM', 'gpu.slotWidth', 'gpu.connectorTypes', 'gpu.connectorCount', 'gpu.boardPowerWatts'],
  Storage: ['storage.interface', 'storage.formFactor'],
  PSU: ['psu.wattage'],
  Case: ['case.supportedFormFactors', 'case.maxGpuLengthMM', 'case.expansionSlots'],
};

/** Total number of expected fact keys across all categories. */
export const TOTAL_EXPECTED_FACT_KEYS = Object.values(EXPECTED_FACT_KEYS).reduce(
  (sum, keys) => sum + keys.length,
  0,
);

/** A category extractor function signature. */
export interface CategoryExtractor {
  readonly category: string;
  readonly extractorVersion: string;
  extract(rawSpecs: readonly SpecEntry[], extractorVersion?: string): CompatibilityFactSet;
}
