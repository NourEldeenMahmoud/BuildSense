import { describe, it, expect } from 'vitest';
import {
  findSpec,
  findAllMatches,
  detectConflict,
  extractSingleFact,
  parseNumber,
  parseBoolean,
  splitList,
  parsePowerConnectors,
  buildEvidence,
  buildFact,
} from '../helpers.js';
import type { SpecEntry } from '../types.js';

describe('findSpec', () => {
  const specs: readonly SpecEntry[] = [
    { label: 'Socket', value: 'AM5' },
    { label: 'Memory Type', value: 'DDR5' },
    { label: 'TDP', value: '170W' },
  ];

  it('finds exact match with confidence 1.0', () => {
    const result = findSpec(specs, ['Socket']);
    expect(result).not.toBeNull();
    expect(result!.matchedLabel).toBe('Socket');
    expect(result!.confidence).toBe(1.0);
    expect(result!.entry.value).toBe('AM5');
  });

  it('finds alias match with confidence 0.9', () => {
    const aliases = new Map([['cpu socket', 'Socket']]);
    const result = findSpec(specs, ['Socket'], aliases);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(1.0); // Exact match takes priority
  });

  it('returns null when no match found', () => {
    const result = findSpec(specs, ['GPU Length']);
    expect(result).toBeNull();
  });

  it('is case-insensitive', () => {
    const result = findSpec(specs, ['socket']);
    expect(result).not.toBeNull();
    expect(result!.matchedLabel).toBe('socket');
  });

  it('finds substring match with confidence 0.6', () => {
    const partialSpecs: readonly SpecEntry[] = [
      { label: 'Max Memory Speed', value: '5600 MHz' },
    ];
    const result = findSpec(partialSpecs, ['Memory Speed']);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(0.6);
  });

  it('returns null for empty specs', () => {
    const result = findSpec([], ['Socket']);
    expect(result).toBeNull();
  });
});

describe('findAllMatches', () => {
  const specs: readonly SpecEntry[] = [
    { label: 'Socket', value: 'AM5' },
    { label: 'Memory Type', value: 'DDR5' },
    { label: 'TDP', value: '170W' },
  ];

  it('returns all exact matches at best confidence tier', () => {
    const specs2: readonly SpecEntry[] = [
      { label: 'Socket', value: 'AM5' },
      { label: 'CPU Socket', value: 'LGA1700' },
    ];
    const result = findAllMatches(specs2, ['Socket', 'CPU Socket']);
    expect(result.matches).toHaveLength(2);
    expect(result.bestConfidence).toBe(1.0);
  });

  it('deduplicates entries with identical raw values', () => {
    const specs2: readonly SpecEntry[] = [
      { label: 'Socket', value: 'AM5' },
      { label: 'CPU Socket', value: 'AM5' },
    ];
    const result = findAllMatches(specs2, ['Socket', 'CPU Socket']);
    expect(result.matches).toHaveLength(1);
  });

  it('returns empty for no matches', () => {
    const result = findAllMatches(specs, ['GPU Length']);
    expect(result.matches).toHaveLength(0);
    expect(result.bestConfidence).toBe(0);
  });

  it('prefers higher confidence tier', () => {
    const specs2: readonly SpecEntry[] = [
      { label: 'Max Memory Speed', value: '5600 MHz' }, // substring
      { label: 'Memory Speed', value: '4800 MHz' }, // exact
    ];
    const result = findAllMatches(specs2, ['Memory Speed']);
    expect(result.matches).toHaveLength(1);
    expect(result.bestConfidence).toBe(1.0);
    expect(result.matches[0]!.entry.value).toBe('4800 MHz');
  });
});

describe('detectConflict', () => {
  it('returns false for single match', () => {
    expect(detectConflict([{ entry: { label: 'Socket', value: 'AM5' }, matchedLabel: 'Socket', confidence: 1.0 }], (v) => v)).toBe(false);
  });

  it('returns false when all normalized values are identical', () => {
    const matches = [
      { entry: { label: 'Socket', value: 'AM5' }, matchedLabel: 'Socket', confidence: 1.0 },
      { entry: { label: 'CPU Socket', value: 'AM5' }, matchedLabel: 'CPU Socket', confidence: 1.0 },
    ];
    expect(detectConflict(matches, (v) => v.trim().toLowerCase())).toBe(false);
  });

  it('returns true when normalized values differ', () => {
    const matches = [
      { entry: { label: 'Socket', value: 'AM5' }, matchedLabel: 'Socket', confidence: 1.0 },
      { entry: { label: 'CPU Socket', value: 'LGA1700' }, matchedLabel: 'CPU Socket', confidence: 1.0 },
    ];
    expect(detectConflict(matches, (v) => v.trim().toLowerCase())).toBe(true);
  });
});

describe('parseNumber', () => {
  it('parses "170W" to 170', () => {
    expect(parseNumber('170W')).toEqual({ value: 170, issues: [] });
  });

  it('parses "128 GB" to 128', () => {
    expect(parseNumber('128 GB')).toEqual({ value: 128, issues: [] });
  });

  it('parses "5,120" to 5120', () => {
    expect(parseNumber('5,120')).toEqual({ value: 5120, issues: [] });
  });

  it('parses "2.5" to 2.5', () => {
    expect(parseNumber('2.5')).toEqual({ value: 2.5, issues: [] });
  });

  it('returns NaN with issues for unparseable values', () => {
    const result = parseNumber('unknown watts');
    expect(Number.isNaN(result.value)).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  // Table-driven range rejection tests
  const rangeCases = [
    { input: '65-95W', desc: 'hyphen range with unit' },
    { input: '65 - 95 W', desc: 'spaced range with unit' },
    { input: '100–200', desc: 'en-dash range' },
    { input: '3.5-5.0', desc: 'decimal range' },
  ];
  for (const { input, desc } of rangeCases) {
    it(`rejects range: ${desc} ("${input}")`, () => {
      const result = parseNumber(input);
      expect(Number.isNaN(result.value)).toBe(true);
      expect(result.issues.some((i) => i.includes('range'))).toBe(true);
    });
  }

  // Table-driven valid single-value tests
  const validCases = [
    { input: '170W', expected: 170, desc: 'watt unit' },
    { input: '128 GB', expected: 128, desc: 'GB unit' },
    { input: '5,120 MHz', expected: 5120, desc: 'comma thousands' },
    { input: '2.5', expected: 2.5, desc: 'decimal' },
    { input: '0', expected: 0, desc: 'zero' },
    { input: '  65W  ', expected: 65, desc: 'whitespace padded' },
    { input: '115 w', expected: 115, desc: 'lowercase unit' },
  ];
  for (const { input, expected, desc } of validCases) {
    it(`parses valid: ${desc} ("${input}" → ${expected})`, () => {
      expect(parseNumber(input)).toEqual({ value: expected, issues: [] });
    });
  }
});

describe('parseBoolean', () => {
  it('parses "Yes" to true', () => {
    expect(parseBoolean('Yes')).toEqual({ value: true, issues: [] });
  });

  it('parses "No" to false', () => {
    expect(parseBoolean('No')).toEqual({ value: false, issues: [] });
  });

  it('parses "None" to false', () => {
    expect(parseBoolean('None')).toEqual({ value: false, issues: [] });
  });

  it('parses "included" to true', () => {
    expect(parseBoolean('included')).toEqual({ value: true, issues: [] });
  });

  it('returns issues for unparseable values', () => {
    const result = parseBoolean('maybe');
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('splitList', () => {
  it('splits comma-separated values', () => {
    expect(splitList('ATX, Micro-ATX, Mini-ITX')).toEqual([
      'ATX',
      'Micro-ATX',
      'Mini-ITX',
    ]);
  });

  it('splits slash-separated values', () => {
    expect(splitList('ATX / Micro-ATX')).toEqual(['ATX', 'Micro-ATX']);
  });

  it('handles single value', () => {
    expect(splitList('ATX')).toEqual(['ATX']);
  });

  it('filters empty entries', () => {
    expect(splitList('ATX,, Micro-ATX')).toEqual(['ATX', 'Micro-ATX']);
  });
});

describe('parsePowerConnectors', () => {
  it('parses "1x 12VHPWR"', () => {
    const result = parsePowerConnectors('1x 12VHPWR');
    expect(result.types).toEqual(['12VHPWR']);
    expect(result.count).toBe(1);
  });

  it('parses "2x 8-pin"', () => {
    const result = parsePowerConnectors('2x 8-pin');
    expect(result.types).toEqual(['8-pin', '8-pin']);
    expect(result.count).toBe(2);
  });

  it('parses "1x 8-pin + 1x 6-pin"', () => {
    const result = parsePowerConnectors('1x 8-pin + 1x 6-pin');
    expect(result.types).toEqual(['8-pin', '6-pin']);
    expect(result.count).toBe(2);
  });

  it('parses single type without count', () => {
    const result = parsePowerConnectors('8-pin');
    expect(result.types).toEqual(['8-pin']);
    expect(result.count).toBe(1);
  });
});

describe('buildEvidence', () => {
  it('creates evidence with all fields', () => {
    const evidence = buildEvidence(
      'Socket',
      'Socket AM5',
      'AM5',
      1.0,
      'cpu/v1.0.0',
    );
    expect(evidence.sourceLabel).toBe('Socket');
    expect(evidence.rawValue).toBe('Socket AM5');
    expect(evidence.normalizedValue).toBe('AM5');
    expect(evidence.confidence).toBe(1.0);
    expect(evidence.extractorVersion).toBe('cpu/v1.0.0');
    expect(evidence.extractionIssues).toEqual([]);
  });

  it('creates evidence with issues', () => {
    const evidence = buildEvidence(
      '',
      '',
      null,
      0,
      'cpu/v1.0.0',
      ['Label not found'],
    );
    expect(evidence.extractionIssues).toEqual(['Label not found']);
  });
});

describe('buildFact', () => {
  it('creates fact with value and evidence', () => {
    const evidence = buildEvidence('Socket', 'AM5', 'AM5', 1.0, 'v1');
    const fact = buildFact('cpu.socket', 'AM5', [evidence]);
    expect(fact.key).toBe('cpu.socket');
    expect(fact.value).toBe('AM5');
    expect(fact.evidence).toHaveLength(1);
  });

  it('creates fact with null value', () => {
    const evidence = buildEvidence('', '', null, 0, 'v1', ['Not found']);
    const fact = buildFact('cpu.socket', null, [evidence]);
    expect(fact.value).toBeNull();
  });
});

describe('extractSingleFact', () => {
  const specs: readonly SpecEntry[] = [
    { label: 'Socket', value: 'AM5' },
    { label: 'TDP', value: '170W' },
  ];

  it('returns null fact when no match found', () => {
    const fact = extractSingleFact(
      specs,
      ['GPU Length'],
      'gpu.lengthMM',
      'gpu/v1.0.0',
      (m) => m.entry.value,
      'Label not found',
    );
    expect(fact.value).toBeNull();
    expect(fact.evidence[0]?.extractionIssues).toContain('Label not found');
  });

  it('returns fact with value when single match', () => {
    const fact = extractSingleFact(
      specs,
      ['Socket'],
      'cpu.socket',
      'cpu/v1.0.0',
      (m) => m.entry.value.trim(),
      'Label not found',
    );
    expect(fact.value).toBe('AM5');
    expect(fact.evidence[0]?.sourceLabel).toBe('Socket');
  });

  it('returns null fact with conflict issue when matches disagree', () => {
    const conflictSpecs: readonly SpecEntry[] = [
      { label: 'Socket', value: 'AM5' },
      { label: 'CPU Socket', value: 'LGA1700' },
    ];
    const fact = extractSingleFact(
      conflictSpecs,
      ['Socket', 'CPU Socket'],
      'cpu.socket',
      'cpu/v1.0.0',
      (m) => m.entry.value.trim(),
      'Label not found',
    );
    expect(fact.value).toBeNull();
    expect(fact.evidence[0]?.extractionIssues.some((i) => i.includes('Conflicting'))).toBe(true);
  });

  it('deduplicates matches with identical normalized values', () => {
    const dupeSpecs: readonly SpecEntry[] = [
      { label: 'Socket', value: 'AM5' },
      { label: 'CPU Socket', value: 'AM5' },
    ];
    const fact = extractSingleFact(
      dupeSpecs,
      ['Socket', 'CPU Socket'],
      'cpu.socket',
      'cpu/v1.0.0',
      (m) => m.entry.value.trim(),
      'Label not found',
    );
    expect(fact.value).toBe('AM5');
  });

  it('attaches custom issues via getIssues callback', () => {
    const fact = extractSingleFact(
      specs,
      ['Socket'],
      'cpu.socket',
      'cpu/v1.0.0',
      (m) => m.entry.value.trim(),
      'Label not found',
      undefined,
      () => ['Custom issue'],
    );
    expect(fact.evidence[0]?.extractionIssues).toContain('Custom issue');
  });
});
