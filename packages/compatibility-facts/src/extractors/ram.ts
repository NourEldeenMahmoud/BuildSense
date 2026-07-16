// ---------------------------------------------------------------------------
// RAM extractor — extracts ram.generation, ram.moduleType, ram.moduleCount,
// ram.capacityGB, ram.speedMHz
// Plan §8.1 / Task P1-6
// ---------------------------------------------------------------------------

import type { CompatibilityFact, CompatibilityFactSet } from '@buildsense/domain';
import type { SpecEntry } from '../types.js';
import { EXTRACTOR_VERSIONS } from '../types.js';
import {
  extractSingleFact,
  normalizeValue,
  buildFactSet,
  parseNumber,
} from '../helpers.js';
import type { SpecMatch } from '../helpers.js';
import {
  GENERATION_ALIASES,
  GENERATION_LABELS,
  GENERATION_LABEL_ALIASES,
} from '../aliases/generation.js';

const CATEGORY = 'RAM';
const VERSION = EXTRACTOR_VERSIONS[CATEGORY]!;

const MODULE_TYPE_LABELS = [
  'Form Factor',
  'Module Type',
  'RAM Form Factor',
  'Memory Form Factor',
];
const MODULE_COUNT_LABELS = ['Modules', 'Kit', 'Count', 'Number of Modules'];
const CAPACITY_LABELS = ['Capacity', 'Size', 'Kit Capacity', 'Total Capacity'];
const SPEED_LABELS = ['Speed', 'Frequency', 'Rated Speed', 'Clock Speed'];

/** Resolve RAM generation from a matched spec entry. */
function resolveGeneration(match: SpecMatch): string | null {
  const rawValue = match.entry.value.trim();
  const { normalized, wasAliased } = normalizeValue(rawValue, GENERATION_ALIASES);
  if (wasAliased) return normalized;
  const ddrMatch = rawValue.match(/ddr\s*(\d+)/i);
  if (ddrMatch && ddrMatch[1]) return `DDR${ddrMatch[1]}`;
  return rawValue;
}

/** Resolve RAM module type from a matched spec entry. */
function resolveModuleType(match: SpecMatch): string | null {
  const lower = match.entry.value.trim().toLowerCase();
  if (lower.includes('so-dimm') || lower.includes('sodimm') || lower.includes('so dimm')) {
    return 'SO-DIMM';
  }
  if (lower.includes('dimm')) return 'DIMM';
  return null;
}

/** Resolve RAM module count from a matched spec entry. */
function resolveModuleCount(match: SpecMatch): number | null {
  // Handle "2x16GB" or "2 x 16 GB" patterns
  const countFromPattern = match.entry.value.match(/^(\d+)\s*x/i);
  if (countFromPattern && countFromPattern[1]) {
    return Number(countFromPattern[1]);
  }
  const { value } = parseNumber(match.entry.value);
  return Number.isNaN(value) ? null : value;
}

/** Resolve RAM capacity from a matched spec entry. */
function resolveCapacity(match: SpecMatch): number | null {
  // Handle "2x16GB" → total = 32
  const kitMatch = match.entry.value.match(/(\d+)\s*x\s*(\d+)\s*gb/i);
  if (kitMatch && kitMatch[1] && kitMatch[2]) {
    return Number(kitMatch[1]) * Number(kitMatch[2]);
  }
  const { value } = parseNumber(match.entry.value);
  return Number.isNaN(value) ? null : value;
}

/** Resolve RAM speed from a matched spec entry. */
function resolveSpeed(match: SpecMatch): number | null {
  const rawValue = match.entry.value.trim();
  const numMatch = rawValue.match(/(\d{3,5})/);
  if (numMatch && numMatch[1]) return Number(numMatch[1]);
  const { value } = parseNumber(rawValue);
  return Number.isNaN(value) ? null : value;
}

/**
 * Extract RAM compatibility facts from raw specifications.
 *
 * Facts: ram.generation, ram.moduleType, ram.moduleCount,
 * ram.capacityGB, ram.speedMHz
 *
 * All fields use findAllMatches + conflict detection.
 */
export function extractRamFacts(
  rawSpecs: readonly SpecEntry[],
  extractorVersion: string = VERSION,
): CompatibilityFactSet {
  const facts: CompatibilityFact[] = [];
  const issues: string[] = [];

  if (rawSpecs.length === 0) {
    issues.push('No specifications found');
    return buildFactSet(CATEGORY, extractorVersion, facts, issues);
  }

  // ---- ram.generation ----
  // May be in "Memory Type: DDR5" or "Speed: DDR5-5600"
  const genFact = extractSingleFact(
    rawSpecs,
    GENERATION_LABELS,
    'ram.generation',
    extractorVersion,
    resolveGeneration,
    'Memory type label not found',
    GENERATION_LABEL_ALIASES,
  );
  // If no generation label matched, try extracting from speed label
  if (
    genFact.value === null &&
    genFact.evidence[0]?.extractionIssues?.some((i) => i.includes('not found'))
  ) {
    const speedFallback = extractSingleFact(
      rawSpecs,
      SPEED_LABELS,
      'ram.generation',
      extractorVersion,
      (m) => {
        const ddrMatch = m.entry.value.match(/ddr\s*(\d+)/i);
        if (ddrMatch && ddrMatch[1]) return `DDR${ddrMatch[1]}`;
        return null;
      },
      'Memory type label not found',
      undefined,
      (m) => {
        const ddrMatch = m.entry.value.match(/ddr\s*(\d+)/i);
        return ddrMatch ? ['Generation extracted from speed label'] : [];
      },
    );
    if (speedFallback.value !== null) {
      facts.push(speedFallback);
    } else {
      facts.push(genFact);
    }
  } else {
    facts.push(genFact);
  }

  // ---- ram.moduleType ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      MODULE_TYPE_LABELS,
      'ram.moduleType',
      extractorVersion,
      resolveModuleType,
      'Module type label not found',
      undefined,
      (m) => {
        const val = resolveModuleType(m);
        return val === null ? ['Module type not parsed from form factor value'] : [];
      },
    ),
  );

  // ---- ram.moduleCount ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      MODULE_COUNT_LABELS,
      'ram.moduleCount',
      extractorVersion,
      resolveModuleCount,
      'Module count label not found',
      undefined,
      (m) => {
        const countFromPattern = m.entry.value.match(/^(\d+)\s*x/i);
        if (countFromPattern) return [];
        const { issues } = parseNumber(m.entry.value);
        return issues;
      },
    ),
  );

  // ---- ram.capacityGB ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      CAPACITY_LABELS,
      'ram.capacityGB',
      extractorVersion,
      resolveCapacity,
      'Capacity label not found',
      undefined,
      (m) => {
        const kitMatch = m.entry.value.match(/(\d+)\s*x\s*(\d+)\s*gb/i);
        if (kitMatch) return [];
        const { issues } = parseNumber(m.entry.value);
        return issues;
      },
    ),
  );

  // ---- ram.speedMHz ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      SPEED_LABELS,
      'ram.speedMHz',
      extractorVersion,
      resolveSpeed,
      'Speed label not found',
      undefined,
      (m) => {
        const rawValue = m.entry.value.trim();
        const numMatch = rawValue.match(/(\d{3,5})/);
        if (numMatch) return [];
        const { issues } = parseNumber(rawValue);
        return issues;
      },
    ),
  );

  return buildFactSet(CATEGORY, extractorVersion, facts, issues);
}
