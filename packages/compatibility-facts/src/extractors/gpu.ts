// ---------------------------------------------------------------------------
// GPU extractor — extracts gpu.lengthMM, gpu.slotWidth, gpu.connectorTypes,
// gpu.connectorCount, gpu.boardPowerWatts
// Plan §8.1 / Task P1-7
// ---------------------------------------------------------------------------

import type { CompatibilityFact, CompatibilityFactSet } from '@buildsense/domain';
import type { SpecEntry } from '../types.js';
import { EXTRACTOR_VERSIONS } from '../types.js';
import {
  extractSingleFact,
  buildFactSet,
  parseNumber,
  parsePowerConnectors,
} from '../helpers.js';
import type { SpecMatch } from '../helpers.js';

const CATEGORY = 'GPU';
const VERSION = EXTRACTOR_VERSIONS[CATEGORY]!;

const LENGTH_LABELS = ['Length', 'GPU Length', 'Card Length', 'Dimensions'];
const SLOT_WIDTH_LABELS = [
  'Slot Width',
  'Slots',
  'Expansion Slots',
  'Slot Count',
];
const CONNECTOR_LABELS = [
  'Power Connectors',
  'PCIe Power',
  'Power Input',
  'Auxiliary Power',
];
const BOARD_POWER_LABELS = [
  'Board Power',
  'TDP',
  'Power Consumption',
  'Max Power',
  'GPU Power',
];

/** Resolve GPU length in mm from a matched spec entry. */
function resolveLength(match: SpecMatch): number | null {
  const rawValue = match.entry.value.trim();
  const mmMatch = rawValue.match(/(\d+(?:\.\d+)?)\s*(?:mm|x)/i);
  if (mmMatch && mmMatch[1]) return Number(mmMatch[1]);
  const { value } = parseNumber(rawValue);
  return Number.isNaN(value) ? null : value;
}

/** Resolve GPU slot width from a matched spec entry. */
function resolveSlotWidth(match: SpecMatch): number | null {
  const { value } = parseNumber(match.entry.value);
  return Number.isNaN(value) ? null : value;
}

/** Resolve GPU connector types from a matched spec entry. */
function resolveConnectorTypes(match: SpecMatch): string[] {
  const { types } = parsePowerConnectors(match.entry.value);
  return types;
}

/** Resolve GPU connector count from a matched spec entry. */
function resolveConnectorCount(match: SpecMatch): number {
  const { count } = parsePowerConnectors(match.entry.value);
  return count;
}

/** Resolve GPU board power from a matched spec entry. */
function resolveBoardPower(match: SpecMatch): number | null {
  const { value } = parseNumber(match.entry.value);
  return Number.isNaN(value) ? null : value;
}

/**
 * Extract GPU compatibility facts from raw specifications.
 *
 * Facts: gpu.lengthMM, gpu.slotWidth, gpu.connectorTypes,
 * gpu.connectorCount, gpu.boardPowerWatts
 *
 * All fields use findAllMatches + conflict detection.
 * "Recommended PSU" is NOT in BOARD_POWER_LABELS — it is a PSU recommendation,
 * not GPU board power.
 */
export function extractGpuFacts(
  rawSpecs: readonly SpecEntry[],
  extractorVersion: string = VERSION,
): CompatibilityFactSet {
  const facts: CompatibilityFact[] = [];
  const issues: string[] = [];

  if (rawSpecs.length === 0) {
    issues.push('No specifications found');
    return buildFactSet(CATEGORY, extractorVersion, facts, issues);
  }

  // ---- gpu.lengthMM ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      LENGTH_LABELS,
      'gpu.lengthMM',
      extractorVersion,
      resolveLength,
      'Length label not found',
    ),
  );

  // ---- gpu.slotWidth ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      SLOT_WIDTH_LABELS,
      'gpu.slotWidth',
      extractorVersion,
      resolveSlotWidth,
      'Slot width label not found',
    ),
  );

  // ---- gpu.connectorTypes ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      CONNECTOR_LABELS,
      'gpu.connectorTypes',
      extractorVersion,
      resolveConnectorTypes,
      'Power connector label not found',
    ),
  );

  // ---- gpu.connectorCount ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      CONNECTOR_LABELS,
      'gpu.connectorCount',
      extractorVersion,
      resolveConnectorCount,
      'Power connector label not found',
    ),
  );

  // ---- gpu.boardPowerWatts ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      BOARD_POWER_LABELS,
      'gpu.boardPowerWatts',
      extractorVersion,
      resolveBoardPower,
      'Board power label not found',
    ),
  );

  return buildFactSet(CATEGORY, extractorVersion, facts, issues);
}
