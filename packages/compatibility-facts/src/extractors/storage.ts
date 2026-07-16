// ---------------------------------------------------------------------------
// Storage extractor — extracts storage.interface, storage.formFactor
// Plan §8.1 / Task P1-8
// ---------------------------------------------------------------------------

import type { CompatibilityFact, CompatibilityFactSet } from '@buildsense/domain';
import type { SpecEntry } from '../types.js';
import { EXTRACTOR_VERSIONS } from '../types.js';
import {
  extractSingleFact,
  normalizeValue,
  buildFactSet,
} from '../helpers.js';
import type { SpecMatch } from '../helpers.js';
import {
  INTERFACE_ALIASES,
  INTERFACE_LABELS,
  INTERFACE_LABEL_ALIASES,
} from '../aliases/interface.js';

const CATEGORY = 'Storage';
const VERSION = EXTRACTOR_VERSIONS[CATEGORY]!;

const FORM_FACTOR_LABELS = [
  'Form Factor',
  'Size',
  'Drive Size',
  'Physical Size',
  'Disk Size',
];

/** Resolve storage interface from a matched spec entry. */
function resolveInterface(match: SpecMatch): string | null {
  const { normalized } = normalizeValue(match.entry.value, INTERFACE_ALIASES);
  return normalized || null;
}

/** Resolve storage form factor from a matched spec entry. */
function resolveFormFactor(match: SpecMatch): string | null {
  const rawValue = match.entry.value.trim();
  const lower = rawValue.toLowerCase();
  if (lower.includes('m.2') || lower.includes('m2')) return rawValue;
  if (lower.includes('2.5')) return '2.5"';
  if (lower.includes('3.5')) return '3.5"';
  return rawValue;
}

/**
 * Extract Storage compatibility facts from raw specifications.
 *
 * Facts: storage.interface, storage.formFactor
 *
 * storage.interface maps to the transport/bus type: "SATA", "NVMe", "PCIe".
 * storage.formFactor maps to the physical form: "2.5\"", "3.5\"", "M.2 2280".
 *
 * All fields use findAllMatches + conflict detection.
 */
export function extractStorageFacts(
  rawSpecs: readonly SpecEntry[],
  extractorVersion: string = VERSION,
): CompatibilityFactSet {
  const facts: CompatibilityFact[] = [];
  const issues: string[] = [];

  if (rawSpecs.length === 0) {
    issues.push('No specifications found');
    return buildFactSet(CATEGORY, extractorVersion, facts, issues);
  }

  // ---- storage.interface ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      INTERFACE_LABELS,
      'storage.interface',
      extractorVersion,
      resolveInterface,
      'Interface label not found',
      INTERFACE_LABEL_ALIASES,
    ),
  );

  // ---- storage.formFactor ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      FORM_FACTOR_LABELS,
      'storage.formFactor',
      extractorVersion,
      resolveFormFactor,
      'Form factor label not found',
    ),
  );

  return buildFactSet(CATEGORY, extractorVersion, facts, issues);
}
