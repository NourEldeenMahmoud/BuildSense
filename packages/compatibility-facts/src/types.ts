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

/** A category extractor function signature. */
export interface CategoryExtractor {
  readonly category: string;
  readonly extractorVersion: string;
  extract(rawSpecs: readonly SpecEntry[], extractorVersion?: string): CompatibilityFactSet;
}
