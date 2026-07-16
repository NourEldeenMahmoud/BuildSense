// ---------------------------------------------------------------------------
// PSU extractor — extracts psu.wattage
// Plan §8.1 / Task P1-9
// ---------------------------------------------------------------------------

import type { CompatibilityFact, CompatibilityFactSet } from '@buildsense/domain';
import type { SpecEntry } from '../types.js';
import { EXTRACTOR_VERSIONS } from '../types.js';
import {
  extractSingleFact,
  buildFactSet,
  parseNumber,
} from '../helpers.js';
import type { SpecMatch } from '../helpers.js';

const CATEGORY = 'PSU';
const VERSION = EXTRACTOR_VERSIONS[CATEGORY]!;

const WATTAGE_LABELS = [
  'Wattage',
  'Power',
  'Output',
  'Rated Power',
  'Total Wattage',
];

/** Resolve PSU wattage from a matched spec entry. */
function resolveWattage(match: SpecMatch): number | null {
  const { value } = parseNumber(match.entry.value);
  return Number.isNaN(value) ? null : value;
}

/** Build evidence issues for a wattage match. */
function wattageIssues(match: SpecMatch): readonly string[] {
  const { issues } = parseNumber(match.entry.value);
  return issues;
}

/**
 * Extract PSU compatibility facts from raw specifications.
 *
 * Facts: psu.wattage
 *
 * NOTE: The approved plan §8.1 fact matrix defines only psu.wattage for PSU.
 * PSU connector inventory is a "future fact" per CMP-PSU-GPU-001 context
 * ("Requires PSU connector inventory (future fact) or heuristic from PSU
 * wattage tier"). Connector inventory extraction is deferred.
 *
 * All fields use findAllMatches + conflict detection.
 */
export function extractPsuFacts(
  rawSpecs: readonly SpecEntry[],
  extractorVersion: string = VERSION,
): CompatibilityFactSet {
  const facts: CompatibilityFact[] = [];
  const issues: string[] = [];

  if (rawSpecs.length === 0) {
    issues.push('No specifications found');
    return buildFactSet(CATEGORY, extractorVersion, facts, issues);
  }

  // ---- psu.wattage ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      WATTAGE_LABELS,
      'psu.wattage',
      extractorVersion,
      resolveWattage,
      'Wattage label not found',
      undefined,
      wattageIssues,
    ),
  );

  return buildFactSet(CATEGORY, extractorVersion, facts, issues);
}
