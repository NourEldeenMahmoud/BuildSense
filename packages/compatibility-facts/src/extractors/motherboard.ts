// ---------------------------------------------------------------------------
// Motherboard extractor — extracts 11 mb.* facts
// Plan §8.1 / Task P1-5
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
import {
  SOCKET_ALIASES,
  SOCKET_LABELS,
  SOCKET_LABEL_ALIASES,
} from '../aliases/socket.js';
import {
  FORM_FACTOR_ALIASES,
  FORM_FACTOR_LABELS,
  FORM_FACTOR_LABEL_ALIASES,
} from '../aliases/form-factor.js';
import {
  GENERATION_ALIASES,
  GENERATION_LABELS,
  GENERATION_LABEL_ALIASES,
} from '../aliases/generation.js';

const CATEGORY = 'Motherboard';
const VERSION = EXTRACTOR_VERSIONS[CATEGORY]!;

const CHIPSET_LABELS = ['Chipset'];
const DIMM_SLOTS_LABELS = [
  'Memory Slots',
  'DIMM Slots',
  'RAM Slots',
  'Slots',
];
const MAX_MEMORY_LABELS = [
  'Max Memory',
  'Maximum Memory',
  'Max RAM',
  'Maximum RAM',
  'Memory Max',
  'Max Memory support',
];
const MAX_SPEED_LABELS = [
  'Max Memory Speed',
  'Max Speed',
  'Memory Speed',
  'RAM Speed',
  'Memory Frequency',
];
const SATA_LABELS = ['SATA Ports', 'SATA', 'SATA3'];
const M2_SLOTS_LABELS = ['M.2 Slots', 'M2 Slots', 'M.2', 'M2'];
const M2_FF_LABELS = [
  'M.2 Form Factors',
  'M.2 Size',
  'M.2 Support',
  'M.2 Types',
];

const MM_TYPE_LABELS = [
  'Module Type',
  'Memory Form Factor',
  'DIMM Type',
  'RAM Form Factor',
];

/**
 * Resolve RAM generation from a matched spec entry.
 * Handles "DDR5", "DDR5 DIMM", "DDR5-5600", etc.
 */
function resolveRamGeneration(
  match: SpecMatch,
): string | null {
  const rawValue = match.entry.value.trim();
  const { normalized, wasAliased } = normalizeValue(
    rawValue,
    GENERATION_ALIASES,
  );
  if (wasAliased) return normalized;
  const ddrMatch = rawValue.match(/ddr\s*(\d+)/i);
  if (ddrMatch && ddrMatch[1]) return `DDR${ddrMatch[1]}`;
  const lower = rawValue.toLowerCase();
  if (['dimm', 'so-dimm', 'sodimm'].some((t) => lower.includes(t))) {
    return null; // Value is only a module type, no generation
  }
  return rawValue;
}

/**
 * Extract Motherboard compatibility facts from raw specifications.
 *
 * Facts: mb.socket, mb.chipset, mb.formFactor, mb.ramGeneration,
 * mb.ramType, mb.dimmSlots, mb.maxMemoryGB, mb.maxMemorySpeedMHz,
 * mb.sataPorts, mb.m2Slots, mb.m2FormFactors
 *
 * All fields use findAllMatches + conflict detection.
 */
export function extractMotherboardFacts(
  rawSpecs: readonly SpecEntry[],
  extractorVersion: string = VERSION,
): CompatibilityFactSet {
  const facts: CompatibilityFact[] = [];
  const issues: string[] = [];

  if (rawSpecs.length === 0) {
    issues.push('No specifications found');
    return buildFactSet(CATEGORY, extractorVersion, facts, issues);
  }

  // ---- mb.socket ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      SOCKET_LABELS,
      'mb.socket',
      extractorVersion,
      (m) => normalizeValue(m.entry.value, SOCKET_ALIASES).normalized,
      'Socket label not found',
      SOCKET_LABEL_ALIASES,
    ),
  );

  // ---- mb.chipset ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      CHIPSET_LABELS,
      'mb.chipset',
      extractorVersion,
      (m) => m.entry.value.trim() || null,
      'Chipset label not found',
    ),
  );

  // ---- mb.formFactor ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      FORM_FACTOR_LABELS,
      'mb.formFactor',
      extractorVersion,
      (m) => normalizeValue(m.entry.value, FORM_FACTOR_ALIASES).normalized,
      'Form factor label not found',
      FORM_FACTOR_LABEL_ALIASES,
    ),
  );

  // ---- mb.ramGeneration ----
  // May be in "Memory Type: DDR5" or compound "DDR5 DIMM"
  facts.push(
    extractSingleFact(
      rawSpecs,
      GENERATION_LABELS,
      'mb.ramGeneration',
      extractorVersion,
      resolveRamGeneration,
      'Memory type label not found',
      GENERATION_LABEL_ALIASES,
    ),
  );

  // ---- mb.ramType ----
  // If generation labels matched, also extract module type from same value
  const genMatch = rawSpecs.find((s) =>
    GENERATION_LABELS.some(
      (l) => s.label.trim().toLowerCase() === l.toLowerCase(),
    ),
  );
  if (genMatch) {
    const lower = genMatch.value.trim().toLowerCase();
    let ramType: string | null = null;
    if (lower.includes('so-dimm') || lower.includes('sodimm') || lower.includes('so dimm')) {
      ramType = 'SO-DIMM';
    } else if (lower.includes('dimm')) {
      ramType = 'DIMM';
    }
    facts.push({
      key: 'mb.ramType',
      value: ramType,
      evidence: [
        {
          sourceLabel: genMatch.label,
          rawValue: genMatch.value,
          normalizedValue: ramType,
          confidence: 1.0,
          extractorVersion,
          extractionIssues:
            ramType === null
              ? ['Module type not found in memory type value']
              : [],
        },
      ],
    });
  } else {
    // Check separate module type label
    const mmTypeMatch = rawSpecs.find((s) =>
      MM_TYPE_LABELS.some(
        (l) => s.label.trim().toLowerCase() === l.toLowerCase(),
      ),
    );
    if (mmTypeMatch) {
      const lower = mmTypeMatch.value.trim().toLowerCase();
      let ramType: string | null = null;
      if (lower.includes('so-dimm') || lower.includes('sodimm')) {
        ramType = 'SO-DIMM';
      } else if (lower.includes('dimm')) {
        ramType = 'DIMM';
      }
      facts.push({
        key: 'mb.ramType',
        value: ramType,
        evidence: [
          {
            sourceLabel: mmTypeMatch.label,
            rawValue: mmTypeMatch.value,
            normalizedValue: ramType,
            confidence: 1.0,
            extractorVersion,
            extractionIssues: [],
          },
        ],
      });
    } else {
      facts.push({
        key: 'mb.ramType',
        value: null,
        evidence: [
          {
            sourceLabel: '',
            rawValue: '',
            normalizedValue: null,
            confidence: 0,
            extractorVersion,
            extractionIssues: ['Memory type label not found'],
          },
        ],
      });
    }
  }

  // ---- mb.dimmSlots ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      DIMM_SLOTS_LABELS,
      'mb.dimmSlots',
      extractorVersion,
      (m) => {
        const { value } = parseNumber(m.entry.value);
        return Number.isNaN(value) ? null : value;
      },
      'DIMM slots label not found',
      undefined,
      (m) => parseNumber(m.entry.value).issues,
    ),
  );

  // ---- mb.maxMemoryGB ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      MAX_MEMORY_LABELS,
      'mb.maxMemoryGB',
      extractorVersion,
      (m) => {
        const { value } = parseNumber(m.entry.value);
        return Number.isNaN(value) ? null : value;
      },
      'Max memory label not found',
      undefined,
      (m) => parseNumber(m.entry.value).issues,
    ),
  );

  // ---- mb.maxMemorySpeedMHz ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      MAX_SPEED_LABELS,
      'mb.maxMemorySpeedMHz',
      extractorVersion,
      (m) => {
        const { value } = parseNumber(m.entry.value);
        return Number.isNaN(value) ? null : value;
      },
      'Max memory speed label not found',
      undefined,
      (m) => parseNumber(m.entry.value).issues,
    ),
  );

  // ---- mb.sataPorts ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      SATA_LABELS,
      'mb.sataPorts',
      extractorVersion,
      (m) => {
        const { value } = parseNumber(m.entry.value);
        return Number.isNaN(value) ? null : value;
      },
      'SATA ports label not found',
      undefined,
      (m) => parseNumber(m.entry.value).issues,
    ),
  );

  // ---- mb.m2Slots ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      M2_SLOTS_LABELS,
      'mb.m2Slots',
      extractorVersion,
      (m) => {
        const { value } = parseNumber(m.entry.value);
        return Number.isNaN(value) ? null : value;
      },
      'M.2 slots label not found',
      undefined,
      (m) => parseNumber(m.entry.value).issues,
    ),
  );

  // ---- mb.m2FormFactors ----
  facts.push(
    extractSingleFact(
      rawSpecs,
      M2_FF_LABELS,
      'mb.m2FormFactors',
      extractorVersion,
      (m) => {
        const formFactors = splitList(m.entry.value.trim());
        return formFactors.length > 0 ? formFactors : null;
      },
      'M.2 form factors label not found',
      undefined,
      (m) => {
        const formFactors = splitList(m.entry.value.trim());
        return formFactors.length === 0 ? ['No M.2 form factors parsed'] : [];
      },
    ),
  );

  return buildFactSet(CATEGORY, extractorVersion, facts, issues);
}
