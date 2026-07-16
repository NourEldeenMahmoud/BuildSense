import { describe, it, expect } from 'vitest';
import { extractCaseFacts } from '../extractors/case.js';
import {
  NZXT_H7_FLOW,
  MESHIFY_C,
  EMPTY_CASE,
  EATX_ONLY_CASE,
  CONFLICT_LENGTH_CASE,
} from '../__fixtures__/case.js';

describe('extractCaseFacts', () => {
  it('extracts all facts from NZXT H7 Flow', () => {
    const result = extractCaseFacts(NZXT_H7_FLOW);

    expect(result.category).toBe('Case');
    expect(result.extractorVersion).toBe('case/v1.0.0');

    expect(result.facts.find((f) => f.key === 'case.supportedFormFactors')?.value).toEqual([
      'ATX',
      'Micro-ATX',
      'Mini-ITX',
    ]);
    expect(result.facts.find((f) => f.key === 'case.maxGpuLengthMM')?.value).toBe(360);
    expect(result.facts.find((f) => f.key === 'case.expansionSlots')?.value).toBe(7);
  });

  it('normalizes "Micro ATX" from slash-separated list', () => {
    const result = extractCaseFacts(MESHIFY_C);
    const formFactors = result.facts.find(
      (f) => f.key === 'case.supportedFormFactors',
    )?.value;
    expect(formFactors).toContain('ATX');
    expect(formFactors).toContain('Micro-ATX');
    expect(formFactors).toContain('Mini-ITX');
    expect(result.facts.find((f) => f.key === 'case.maxGpuLengthMM')?.value).toBe(315);
  });

  it('normalizes "E-ATX" from aliases', () => {
    const result = extractCaseFacts(EATX_ONLY_CASE);
    const formFactors = result.facts.find(
      (f) => f.key === 'case.supportedFormFactors',
    )?.value;
    expect(formFactors).toContain('E-ATX');
    expect(formFactors).toContain('ATX');
    expect(result.facts.find((f) => f.key === 'case.maxGpuLengthMM')?.value).toBe(400);
    expect(result.facts.find((f) => f.key === 'case.expansionSlots')?.value).toBe(8);
  });

  it('returns null facts for empty specs', () => {
    const result = extractCaseFacts(EMPTY_CASE);
    expect(result.extractionIssues).toContain('No specifications found');
    expect(result.facts).toHaveLength(0);
  });

  it('does not mutate input', () => {
    const original = [...NZXT_H7_FLOW];
    extractCaseFacts(NZXT_H7_FLOW);
    expect(NZXT_H7_FLOW).toEqual(original);
  });

  it('returns null GPU length when conflicting labels disagree', () => {
    const result = extractCaseFacts(CONFLICT_LENGTH_CASE);
    const gpuLen = result.facts.find((f) => f.key === 'case.maxGpuLengthMM');
    expect(gpuLen?.value).toBeNull();
    expect(
      gpuLen?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('Conflicting'),
      ),
    ).toBe(true);
    // Other facts should still extract normally
    expect(result.facts.find((f) => f.key === 'case.supportedFormFactors')?.value).toEqual(['ATX']);
    expect(result.facts.find((f) => f.key === 'case.expansionSlots')?.value).toBe(7);
  });
});
