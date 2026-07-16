// ---------------------------------------------------------------------------
// CPU extractor — extracts cpu.socket, cpu.family, cpu.iGpu, cpu.tdpWatts
// Plan §8.1 / Task P1-4
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
  SOCKET_ALIASES,
  SOCKET_LABELS,
  SOCKET_LABEL_ALIASES,
} from '../aliases/socket.js';

const CATEGORY = 'CPU';
const VERSION = EXTRACTOR_VERSIONS[CATEGORY]!;

const FAMILY_LABELS = ['Family', 'Series', 'Processor Family', 'CPU Family'];
const IGPU_LABELS = [
  'Integrated Graphics',
  'iGPU',
  'Graphics',
  'Integrated GPU',
];
const TDP_LABELS = ['TDP', 'Power', 'TDP (W)', 'Processor Power'];

const NEGATIVE_IGPU = new Set([
  'no',
  'none',
  'n/a',
  'na',
  'false',
  '0',
  'not applicable',
  'n.a.',
]);

const POSITIVE_IGPU = new Set(['yes', 'true', '1']);

/**
 * Known integrated graphics model names. Only values matching these patterns
 * are treated as "present". Arbitrary non-empty strings that do not match
 * any known model name → null (unknown), not true.
 */
const IGPU_MODEL_PATTERNS: readonly RegExp[] = [
  /intel\s*(uhd|iris|hd)\s*\d*/i,
  /radeon\s*( graphics| vega|rx)/i,
  /vega\s*\d*/i,
  /\buhd\s*\d+/i,
  /\biris\s*(xe|plus|pro|xe\s*max)/i,
  /\bhd\s*graphics\s*\d*/i,
];

/** Resolve iGpu value from a matched spec entry. */
function resolveIgpu(match: SpecMatch): boolean | null {
  const rawValue = match.entry.value.trim();
  if (rawValue.length === 0) return null;
  const lower = rawValue.toLowerCase();
  if (NEGATIVE_IGPU.has(lower)) return false;
  if (POSITIVE_IGPU.has(lower)) return true;
  if (IGPU_MODEL_PATTERNS.some((re) => re.test(rawValue))) return true;
  return null;
}

/** Build evidence issues for an iGpu match. */
function igpuIssues(match: SpecMatch): readonly string[] {
  const rawValue = match.entry.value.trim();
  if (rawValue.length === 0) return ['Empty value for integrated graphics'];
  const lower = rawValue.toLowerCase();
  if (NEGATIVE_IGPU.has(lower)) return [];
  if (POSITIVE_IGPU.has(lower)) return [];
  if (IGPU_MODEL_PATTERNS.some((re) => re.test(rawValue))) return [];
  return [`Unrecognized iGPU value "${rawValue}" — not treated as present`];
}

/** Resolve TDP watts from a matched spec entry. */
function resolveTdp(match: SpecMatch): number | null {
  const { value } = parseNumber(match.entry.value);
  return Number.isNaN(value) ? null : value;
}

/** Build evidence issues for a TDP match. */
function tdpIssues(match: SpecMatch): readonly string[] {
  const { issues } = parseNumber(match.entry.value);
  return issues;
}

/**
 * Extract CPU compatibility facts from raw specifications.
 *
 * Facts:
 * - cpu.socket: normalized socket name (e.g., "AM5", "LGA1700")
 * - cpu.family: processor family name
 * - cpu.iGpu: integrated graphics presence (boolean | null)
 * - cpu.tdpWatts: thermal design power in watts (number | null)
 *
 * Never infers CPU/chipset support. CMP-CPU-MB-002 support is not inferred.
 * All fields use findAllMatches + conflict detection: conflicting specs
 * produce null values with conflict issues in evidence.
 */
export function extractCpuFacts(
  rawSpecs: readonly SpecEntry[],
  extractorVersion: string = VERSION,
): CompatibilityFactSet {
  const facts: CompatibilityFact[] = [];
  const issues: string[] = [];

  if (rawSpecs.length === 0) {
    issues.push('No specifications found');
    return buildFactSet(CATEGORY, extractorVersion, facts, issues);
  }

  // ---- cpu.socket ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      SOCKET_LABELS,
      'cpu.socket',
      extractorVersion,
      (m) => normalizeValue(m.entry.value, SOCKET_ALIASES).normalized,
      'Socket label not found',
      SOCKET_LABEL_ALIASES,
    ),
  );

  // ---- cpu.family ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      FAMILY_LABELS,
      'cpu.family',
      extractorVersion,
      (m) => m.entry.value.trim() || null,
      'Family label not found',
    ),
  );

  // ---- cpu.iGpu ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      IGPU_LABELS,
      'cpu.iGpu',
      extractorVersion,
      resolveIgpu,
      'Integrated graphics label not found',
      undefined,
      igpuIssues,
    ),
  );

  // ---- cpu.tdpWatts ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      TDP_LABELS,
      'cpu.tdpWatts',
      extractorVersion,
      resolveTdp,
      'TDP label not found',
      undefined,
      tdpIssues,
    ),
  );

  return buildFactSet(CATEGORY, extractorVersion, facts, issues);
}
