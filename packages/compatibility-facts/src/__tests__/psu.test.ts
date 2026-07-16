import { describe, it, expect } from 'vitest';
import { extractPsuFacts } from '../extractors/psu.js';
import {
  CORSAIR_RM850X,
  EVGA_650_G7,
  EMPTY_PSU,
  MALFORMED_PSU,
  CONFLICT_WATTAGE_PSU,
  EMPTY_WATTAGE_PSU,
} from '../__fixtures__/psu.js';

describe('extractPsuFacts', () => {
  it('extracts wattage from Corsair RM850x', () => {
    const result = extractPsuFacts(CORSAIR_RM850X);

    expect(result.category).toBe('PSU');
    expect(result.extractorVersion).toBe('psu/v1.0.0');

    expect(result.facts.find((f) => f.key === 'psu.wattage')?.value).toBe(850);
  });

  it('extracts wattage from EVGA 650 G7', () => {
    const result = extractPsuFacts(EVGA_650_G7);
    expect(result.facts.find((f) => f.key === 'psu.wattage')?.value).toBe(650);
  });

  it('returns null for malformed wattage', () => {
    const result = extractPsuFacts(MALFORMED_PSU);
    expect(result.facts.find((f) => f.key === 'psu.wattage')?.value).toBeNull();
  });

  it('returns null facts for empty specs', () => {
    const result = extractPsuFacts(EMPTY_PSU);
    expect(result.extractionIssues).toContain('No specifications found');
    expect(result.facts).toHaveLength(0);
  });

  it('does not mutate input', () => {
    const original = [...CORSAIR_RM850X];
    extractPsuFacts(CORSAIR_RM850X);
    expect(CORSAIR_RM850X).toEqual(original);
  });

  it('returns null wattage when conflicting labels disagree', () => {
    const result = extractPsuFacts(CONFLICT_WATTAGE_PSU);
    const wattFact = result.facts.find((f) => f.key === 'psu.wattage');
    expect(wattFact?.value).toBeNull();
    expect(
      wattFact?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('Conflicting'),
      ),
    ).toBe(true);
  });

  it('returns null wattage for empty value', () => {
    const result = extractPsuFacts(EMPTY_WATTAGE_PSU);
    const wattFact = result.facts.find((f) => f.key === 'psu.wattage');
    expect(wattFact?.value).toBeNull();
    expect(
      wattFact?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('Unable to parse'),
      ),
    ).toBe(true);
  });
});
