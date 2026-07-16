// ---------------------------------------------------------------------------
// Case extractor — extracts case.maxGpuLengthMM, case.expansionSlots,
// case.supportedFormFactors
// Plan §8.1 / Task P1-10
// ---------------------------------------------------------------------------

import type { CompatibilityFact, CompatibilityFactSet } from '@buildsense/domain';
import type { SpecEntry } from '../types.js';
import { EXTRACTOR_VERSIONS } from '../types.js';
import {
  extractSingleFact,
  normalizeValue,
  buildFactSet,
  parseNumber,
  splitList,
} from '../helpers.js';
import type { SpecMatch } from '../helpers.js';
import { FORM_FACTOR_ALIASES } from '../aliases/form-factor.js';

const CATEGORY = 'Case';
const VERSION = EXTRACTOR_VERSIONS[CATEGORY]!;

const FORM_FACTOR_LABELS = [
  'Motherboard Support',
  'Supported Form Factors',
  'Motherboard Form Factor',
  'Compatibility',
  'Motherboard Compatibility',
];
const GPU_LENGTH_LABELS = [
  'Max GPU Length',
  'GPU Clearance',
  'Max Graphics Card Length',
  'Graphics Card Clearance',
  'GPU Length',
];
const EXPANSION_SLOTS_LABELS = [
  'Expansion Slots',
  'PCI Slots',
  'PCIe Slots',
  'External Slots',
  'Slot Count',
];

/** Resolve supported form factors from a matched spec entry. */
function resolveFormFactors(match: SpecMatch): string[] | null {
  const rawValue = match.entry.value.trim();
  const parts = splitList(rawValue);
  const formFactors = parts.map((p) => {
    const { normalized } = normalizeValue(p, FORM_FACTOR_ALIASES);
    return normalized;
  });
  return formFactors.length > 0 ? formFactors : null;
}

/** Resolve max GPU length in mm from a matched spec entry. */
function resolveGpuLength(match: SpecMatch): number | null {
  const rawValue = match.entry.value.trim();
  const mmMatch = rawValue.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (mmMatch && mmMatch[1]) return Number(mmMatch[1]);
  const { value } = parseNumber(rawValue);
  return Number.isNaN(value) ? null : value;
}

/** Resolve expansion slots from a matched spec entry. */
function resolveExpansionSlots(match: SpecMatch): number | null {
  const { value } = parseNumber(match.entry.value);
  return Number.isNaN(value) ? null : value;
}

/**
 * Extract Case compatibility facts from raw specifications.
 *
 * Facts: case.maxGpuLengthMM, case.expansionSlots, case.supportedFormFactors
 *
 * All fields use findAllMatches + conflict detection.
 */
export function extractCaseFacts(
  rawSpecs: readonly SpecEntry[],
  extractorVersion: string = VERSION,
): CompatibilityFactSet {
  const facts: CompatibilityFact[] = [];
  const issues: string[] = [];

  if (rawSpecs.length === 0) {
    issues.push('No specifications found');
    return buildFactSet(CATEGORY, extractorVersion, facts, issues);
  }

  // ---- case.supportedFormFactors ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      FORM_FACTOR_LABELS,
      'case.supportedFormFactors',
      extractorVersion,
      resolveFormFactors,
      'Form factor support label not found',
      undefined,
      (m) => {
        const val = resolveFormFactors(m);
        return val === null ? ['No form factors parsed from value'] : [];
      },
    ),
  );

  // ---- case.maxGpuLengthMM ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      GPU_LENGTH_LABELS,
      'case.maxGpuLengthMM',
      extractorVersion,
      resolveGpuLength,
      'GPU length label not found',
    ),
  );

  // ---- case.expansionSlots ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      EXPANSION_SLOTS_LABELS,
      'case.expansionSlots',
      extractorVersion,
      resolveExpansionSlots,
      'Expansion slots label not found',
    ),
  );

  return buildFactSet(CATEGORY, extractorVersion, facts, issues);
}
