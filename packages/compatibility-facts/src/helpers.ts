// ---------------------------------------------------------------------------
// Shared helpers for label matching, evidence building, value parsing
// ---------------------------------------------------------------------------

import type {
  FactEvidence,
  CompatibilityFact,
  CompatibilityFactSet,
} from '@buildsense/domain';
import type { SpecEntry } from './types.js';

/**
 * Find a spec entry by matching label against known labels.
 *
 * Match priority (highest confidence first):
 * 1. Exact match (case-insensitive) → 1.0
 * 2. Alias match → 0.9
 * 3. Substring match → 0.6
 */
export type SpecMatch = {
  entry: SpecEntry;
  matchedLabel: string;
  confidence: number;
};

/**
 * Classify a single spec entry against known labels at all three tiers.
 * Returns the best match or null.
 */
function classifySpec(
  entry: SpecEntry,
  knownLabels: readonly string[],
  labelAliases?: ReadonlyMap<string, string>,
): SpecMatch | null {
  const normalizedLabel = entry.label.trim().toLowerCase();

  // 1. Exact match
  for (const known of knownLabels) {
    if (normalizedLabel === known.toLowerCase()) {
      return { entry, matchedLabel: known, confidence: 1.0 };
    }
  }

  // 2. Alias match
  if (labelAliases) {
    for (const [alias, target] of labelAliases) {
      if (normalizedLabel === alias.toLowerCase()) {
        const matchedKnown = knownLabels.find(
          (k) => k.toLowerCase() === target.toLowerCase(),
        );
        if (matchedKnown) {
          return { entry, matchedLabel: matchedKnown, confidence: 0.9 };
        }
      }
    }
  }

  // 3. Substring match — forward only (entry label contains known label).
  // Reverse direction (known.includes(entry)) is rejected because it causes
  // generic labels like "Form Factor" to falsely match specific labels like
  // "M.2 Form Factors", and product names like "GPU" to match "GPU Length".
  for (const known of knownLabels) {
    const knownLower = known.toLowerCase();
    if (normalizedLabel.includes(knownLower)) {
      return { entry, matchedLabel: known, confidence: 0.6 };
    }
  }

  return null;
}

/**
 * Find all spec entries matching known labels at the best confidence tier.
 *
 * Returns the highest confidence tier found, and every entry matching at that
 * tier. Identical normalized values across duplicates collapse to one result.
 * Multiple different values at the same tier indicate a conflict — callers
 * should check `detectConflict` on the result.
 */
export function findAllMatches(
  specs: readonly SpecEntry[],
  knownLabels: readonly string[],
  labelAliases?: ReadonlyMap<string, string>,
): {
  matches: readonly SpecMatch[];
  bestConfidence: number;
} {
  // Classify every spec entry
  const classified: SpecMatch[] = [];
  for (const entry of specs) {
    const match = classifySpec(entry, knownLabels, labelAliases);
    if (match) {
      classified.push(match);
    }
  }

  if (classified.length === 0) {
    return { matches: [], bestConfidence: 0 };
  }

  // Find best confidence tier
  const bestConfidence = Math.max(...classified.map((m) => m.confidence));

  // Filter to best tier only
  const bestTier = classified.filter(
    (m) => m.confidence === bestConfidence,
  );

  // Deduplicate by normalized value (same raw value = same spec, skip dups)
  const seen = new Set<string>();
  const deduplicated: SpecMatch[] = [];
  for (const match of bestTier) {
    const key = match.entry.value.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(match);
    }
  }

  return { matches: deduplicated, bestConfidence };
}

/**
 * Detect whether multiple matches at the same confidence tier disagree on
 * the normalized value. Returns true if there is a genuine conflict.
 */
export function detectConflict(
  matches: readonly SpecMatch[],
  normalize: (rawValue: string) => string,
): boolean {
  if (matches.length <= 1) return false;
  const normalizedValues = new Set(matches.map((m) => normalize(m.entry.value)));
  return normalizedValues.size > 1;
}

/**
 * Resolve a set of spec matches into a single fact value.
 *
 * - No matches → null with "label not found" issue
 * - Single match → use its value
 * - Multiple matches, same normalized value → use first (deduplicated)
 * - Multiple matches, conflicting values → null with conflict issue
 *
 * The caller provides `resolveValue` to transform a match's raw value into
 * the fact value (e.g., parseNumber, normalizeValue, trim).
 * Optional `getIssues` returns per-match extraction issues for evidence.
 */
export function resolveMatches<T>(
  matches: readonly SpecMatch[],
  resolveValue: (match: SpecMatch) => T,
  factKey: string,
  extractorVersion: string,
  notFoundIssue: string,
  getIssues?: (match: SpecMatch) => readonly string[],
): CompatibilityFact {
  if (matches.length === 0) {
    return buildFact(factKey, null, [
      buildEvidence('', '', null, 0, extractorVersion, [notFoundIssue]),
    ]);
  }

  if (matches.length === 1) {
    const primary = matches[0]!;
    const value = resolveValue(primary);
    const normalizedStr =
      value === null || value === undefined
        ? null
        : String(value);
    const matchIssues = getIssues ? getIssues(primary) : [];
    return buildFact(factKey, value, [
      buildEvidence(
        primary.entry.label,
        primary.entry.value,
        normalizedStr,
        primary.confidence,
        extractorVersion,
        matchIssues,
      ),
    ]);
  }

  // Multiple matches — check for conflicts
  const resolved = matches.map((m) => ({
    match: m,
    value: resolveValue(m),
  }));
  const uniqueValues = new Set(
    resolved.map((r) => JSON.stringify(r.value)),
  );

  if (uniqueValues.size === 1) {
    // All resolve to the same value — use first match
    const primary = resolved[0]!;
    const normalizedStr =
      primary.value === null || primary.value === undefined
        ? null
        : String(primary.value);
    const matchIssues = getIssues ? getIssues(primary.match) : [];
    return buildFact(factKey, primary.value, [
      buildEvidence(
        primary.match.entry.label,
        primary.match.entry.value,
        normalizedStr,
        primary.match.confidence,
        extractorVersion,
        matchIssues,
      ),
    ]);
  }

  // Conflict: values disagree
  const conflictingPairs = matches
    .map((m) => `${m.entry.label}="${m.entry.value}"`)
    .join(' vs ');
  return buildFact(factKey, null, [
    buildEvidence(
      matches[0]!.entry.label,
      matches[0]!.entry.value,
      null,
      matches[0]!.confidence,
      extractorVersion,
      [`Conflicting specs for ${factKey}: ${conflictingPairs}`],
    ),
  ]);
}

/**
 * High-level helper: find all matches, resolve to a single fact.
 * Encapsulates findAllMatches + resolveMatches for common use.
 */
export function extractSingleFact<T>(
  specs: readonly SpecEntry[],
  knownLabels: readonly string[],
  factKey: string,
  extractorVersion: string,
  resolveValue: (match: SpecMatch) => T,
  notFoundIssue: string,
  labelAliases?: ReadonlyMap<string, string>,
  getIssues?: (match: SpecMatch) => readonly string[],
): CompatibilityFact {
  const { matches } = findAllMatches(specs, knownLabels, labelAliases);
  return resolveMatches(matches, resolveValue, factKey, extractorVersion, notFoundIssue, getIssues);
}

/**
 * Find a spec entry by matching label against known labels.
 *
 * Match priority (highest confidence first):
 * 1. Exact match (case-insensitive) → 1.0
 * 2. Alias match → 0.9
 * 3. Substring match → 0.6
 */
export function findSpec(
  specs: readonly SpecEntry[],
  knownLabels: readonly string[],
  labelAliases?: ReadonlyMap<string, string>,
): SpecMatch | null {
  // 1. Exact match
  for (const entry of specs) {
    const normalizedLabel = entry.label.trim().toLowerCase();
    for (const known of knownLabels) {
      if (normalizedLabel === known.toLowerCase()) {
        return { entry, matchedLabel: known, confidence: 1.0 };
      }
    }
  }

  // 2. Alias match
  if (labelAliases) {
    for (const entry of specs) {
      const normalizedLabel = entry.label.trim().toLowerCase();
      for (const [alias, target] of labelAliases) {
        if (normalizedLabel === alias.toLowerCase()) {
          const matchedKnown = knownLabels.find(
            (k) => k.toLowerCase() === target.toLowerCase(),
          );
          if (matchedKnown) {
            return { entry, matchedLabel: matchedKnown, confidence: 0.9 };
          }
        }
      }
    }
  }

  // 3. Substring match (lower confidence) — forward only
  for (const entry of specs) {
    const normalizedLabel = entry.label.trim().toLowerCase();
    for (const known of knownLabels) {
      const knownLower = known.toLowerCase();
      if (normalizedLabel.includes(knownLower)) {
        return { entry, matchedLabel: known, confidence: 0.6 };
      }
    }
  }

  return null;
}

/**
 * Normalize a value using an alias map.
 * Returns the normalized value and whether an alias was applied.
 */
export function normalizeValue(
  value: string,
  aliasMap: ReadonlyMap<string, string>,
): { normalized: string; wasAliased: boolean } {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  // Exact match
  for (const [alias, target] of aliasMap) {
    if (lower === alias.toLowerCase()) {
      return { normalized: target, wasAliased: true };
    }
  }

  // Substring match (for compound values like "Socket AM5")
  for (const [alias, target] of aliasMap) {
    if (lower.includes(alias.toLowerCase())) {
      return { normalized: target, wasAliased: true };
    }
  }

  return { normalized: trimmed, wasAliased: false };
}

/**
 * Build a FactEvidence object.
 */
export function buildEvidence(
  sourceLabel: string,
  rawValue: string,
  normalizedValue: string | null,
  confidence: number,
  extractorVersion: string,
  issues: readonly string[] = [],
): FactEvidence {
  return {
    sourceLabel,
    rawValue,
    normalizedValue,
    confidence,
    extractorVersion,
    extractionIssues: issues,
  };
}

/**
 * Build a CompatibilityFact.
 */
export function buildFact(
  key: string,
  value: unknown,
  evidence: readonly FactEvidence[],
): CompatibilityFact {
  return { key, value, evidence };
}

/**
 * Build a CompatibilityFactSet with current timestamp.
 */
export function buildFactSet(
  category: string,
  extractorVersion: string,
  facts: readonly CompatibilityFact[],
  extractionIssues: readonly string[] = [],
): CompatibilityFactSet {
  return {
    category,
    extractorVersion,
    facts,
    extractedAt: new Date().toISOString(),
    extractionIssues,
  };
}

/**
 * Parse a number from a string, handling common formats:
 * - "170W" → 170
 * - "128 GB" → 128
 * - "5,120 MHz" → 5120
 * - "2.5" → 2.5
 *
 * Rejects scalar ranges (e.g., "65-95W") and model/version numbers.
 */
export function parseNumber(value: string): {
  value: number;
  issues: string[];
} {
  const issues: string[] = [];
  const trimmed = value.trim();

  // Reject scalar ranges like "65-95W" or "65 - 95 W"
  if (/^\d+(\.\d+)?\s*[-–]\s*\d+(\.\d+)?/.test(trimmed)) {
    issues.push(`Rejected scalar range "${value}" — only single values accepted`);
    return { value: Number.NaN, issues };
  }

  // Strip whitespace/commas then extract the leading numeric value.
  // Old approach stripped trailing alpha chars, which failed when the
  // suffix contained digits (e.g. "256GB DDR5" → "256GBDDR5" → trailing
  // '5' prevented the alpha regex from matching).
  const stripped = trimmed.replace(/[,\s]/g, '');
  const leadingNum = stripped.match(/^(\d+(?:\.\d+)?)/);
  const cleaned = leadingNum?.[1] ?? '';

  if (cleaned.length === 0) {
    issues.push(`Unable to parse number from "${value}"`);
    return { value: Number.NaN, issues };
  }

  const num = Number(cleaned);
  if (Number.isNaN(num)) {
    issues.push(`Unable to parse number from "${value}"`);
    return { value: Number.NaN, issues };
  }
  return { value: num, issues };
}

/**
 * Parse a boolean from common string representations.
 */
export function parseBoolean(value: string): {
  value: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const normalized = value.trim().toLowerCase();

  const truthy = [
    'yes',
    'true',
    '1',
    'included',
    'integrated',
    'built-in',
    'onboard',
    'has',
  ];
  const falsy = [
    'no',
    'false',
    '0',
    'none',
    'dedicated',
    'discrete',
    'not included',
    'without',
  ];

  if (truthy.includes(normalized)) {
    return { value: true, issues };
  }
  if (falsy.includes(normalized)) {
    return { value: false, issues };
  }

  issues.push(`Unable to parse boolean from "${value}"`);
  return { value: false, issues };
}

/**
 * Split a string into a list using common delimiters.
 * Trims and filters empty entries.
 */
export function splitList(
  value: string,
  delimiters: readonly string[] = [',', '/', ';'],
): string[] {
  let result = [value];
  for (const delim of delimiters) {
    result = result.flatMap((item) => item.split(delim));
  }
  return result
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Parse power connector specs like "1x 12VHPWR" or "2x 8-pin + 1x 6-pin".
 */
export function parsePowerConnectors(value: string): {
  types: string[];
  count: number;
  issues: string[];
} {
  const issues: string[] = [];
  const types: string[] = [];

  // Split by + or ,
  const parts = value
    .split(/[+,]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const part of parts) {
    // Match "Nx TYPE" pattern — supports both ASCII "x" and Unicode "×" (U+00D7)
    const match = part.match(/(\d+)\s*[x×]\s*(.+)/i);
    if (match && match[1] && match[2]) {
      const count = Number(match[1]);
      const type = match[2].trim();
      for (let i = 0; i < count; i++) {
        types.push(type);
      }
    } else {
      // Just a type name
      types.push(part);
    }
  }

  if (types.length === 0) {
    issues.push(`Unable to parse power connectors from "${value}"`);
  }

  return { types, count: types.length, issues };
}
