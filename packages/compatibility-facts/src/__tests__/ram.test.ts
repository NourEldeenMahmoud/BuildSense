import { describe, it, expect } from 'vitest';
import { extractRamFacts } from '../extractors/ram.js';
import {
  DDR5_5600_32GB,
  DDR4_3200_16GB,
  DDR5_SODIMM_16GB,
  EMPTY_RAM,
  DDR5_6000_64GB,
  CONFLICT_SPEED_RAM,
  EMPTY_CAPACITY_RAM,
} from '../__fixtures__/ram.js';

describe('extractRamFacts', () => {
  it('extracts all facts from DDR5-5600 32GB kit', () => {
    const result = extractRamFacts(DDR5_5600_32GB);

    expect(result.category).toBe('RAM');
    expect(result.extractorVersion).toBe('ram/v1.0.0');

    expect(result.facts.find((f) => f.key === 'ram.generation')?.value).toBe('DDR5');
    expect(result.facts.find((f) => f.key === 'ram.moduleType')?.value).toBe('DIMM');
    expect(result.facts.find((f) => f.key === 'ram.moduleCount')?.value).toBe(2);
    expect(result.facts.find((f) => f.key === 'ram.capacityGB')?.value).toBe(32);
    expect(result.facts.find((f) => f.key === 'ram.speedMHz')?.value).toBe(5600);
  });

  it('extracts DDR4 facts', () => {
    const result = extractRamFacts(DDR4_3200_16GB);
    expect(result.facts.find((f) => f.key === 'ram.generation')?.value).toBe('DDR4');
    expect(result.facts.find((f) => f.key === 'ram.speedMHz')?.value).toBe(3200);
    expect(result.facts.find((f) => f.key === 'ram.capacityGB')?.value).toBe(16);
  });

  it('extracts SO-DIMM module type', () => {
    const result = extractRamFacts(DDR5_SODIMM_16GB);
    expect(result.facts.find((f) => f.key === 'ram.moduleType')?.value).toBe('SO-DIMM');
    expect(result.facts.find((f) => f.key === 'ram.capacityGB')?.value).toBe(16);
  });

  it('extracts generation from speed label "DDR5-6000"', () => {
    const result = extractRamFacts(DDR5_6000_64GB);
    expect(result.facts.find((f) => f.key === 'ram.generation')?.value).toBe('DDR5');
    expect(result.facts.find((f) => f.key === 'ram.speedMHz')?.value).toBe(6000);
  });

  it('returns null facts for empty specs', () => {
    const result = extractRamFacts(EMPTY_RAM);
    expect(result.extractionIssues).toContain('No specifications found');
    expect(result.facts).toHaveLength(0);
  });

  it('does not mutate input', () => {
    const original = [...DDR5_5600_32GB];
    extractRamFacts(DDR5_5600_32GB);
    expect(DDR5_5600_32GB).toEqual(original);
  });

  it('every fact has evidence', () => {
    const result = extractRamFacts(DDR5_5600_32GB);
    for (const fact of result.facts) {
      expect(fact.evidence.length).toBeGreaterThan(0);
    }
  });

  it('returns null speed when conflicting speed labels disagree', () => {
    const result = extractRamFacts(CONFLICT_SPEED_RAM);
    const speedFact = result.facts.find((f) => f.key === 'ram.speedMHz');
    expect(speedFact?.value).toBeNull();
    expect(
      speedFact?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('Conflicting'),
      ),
    ).toBe(true);
    // Other facts should still extract normally
    expect(result.facts.find((f) => f.key === 'ram.generation')?.value).toBe('DDR5');
  });

  it('returns null capacity for empty capacity value', () => {
    const result = extractRamFacts(EMPTY_CAPACITY_RAM);
    const capFact = result.facts.find((f) => f.key === 'ram.capacityGB');
    expect(capFact?.value).toBeNull();
    expect(
      capFact?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('Unable to parse'),
      ),
    ).toBe(true);
  });
});
