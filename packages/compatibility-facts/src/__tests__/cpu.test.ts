import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractCpuFacts } from '../extractors/cpu.js';
import {
  RYZEN_7700X,
  I7_13700K,
  EMPTY_CPU,
  MISSING_SOCKET_CPU,
  MALFORMED_TDP_CPU,
  IGPU_PRESENT_CPU,
  IGPU_EMPTY_CPU,
  IGPU_UNKNOWN_CPU,
  IGPU_NA_CPU,
  IGPU_UHD_CPU,
  IGPU_RADEON_CPU,
  IGPU_AMBIGUOUS_CPU,
  NO_IGPU_LABEL_CPU,
} from '../__fixtures__/cpu.js';

describe('extractCpuFacts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('extracts all facts from AMD Ryzen 7 7700X', () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const result = extractCpuFacts(RYZEN_7700X);

    expect(result.category).toBe('CPU');
    expect(result.extractorVersion).toBe('cpu/v1.0.0');
    expect(result.extractionIssues).toEqual([]);

    const socketFact = result.facts.find((f) => f.key === 'cpu.socket');
    expect(socketFact?.value).toBe('AM5');
    expect(socketFact?.evidence[0]?.sourceLabel).toBe('Socket');
    expect(socketFact?.evidence[0]?.rawValue).toBe('Socket AM5');

    const familyFact = result.facts.find((f) => f.key === 'cpu.family');
    expect(familyFact?.value).toBe('AMD Ryzen 7');

    const igpuFact = result.facts.find((f) => f.key === 'cpu.iGpu');
    expect(igpuFact?.value).toBe(false);

    const tdpFact = result.facts.find((f) => f.key === 'cpu.tdpWatts');
    expect(tdpFact?.value).toBe(170);
  });

  it('extracts facts from Intel i7-13700K with iGPU', () => {
    const result = extractCpuFacts(I7_13700K);

    const socketFact = result.facts.find((f) => f.key === 'cpu.socket');
    expect(socketFact?.value).toBe('LGA1700');

    const familyFact = result.facts.find((f) => f.key === 'cpu.family');
    expect(familyFact?.value).toBe('Intel Core i7');

    const igpuFact = result.facts.find((f) => f.key === 'cpu.iGpu');
    expect(igpuFact?.value).toBe(true);

    const tdpFact = result.facts.find((f) => f.key === 'cpu.tdpWatts');
    expect(tdpFact?.value).toBe(125);
  });

  it('returns null facts for empty specs', () => {
    const result = extractCpuFacts(EMPTY_CPU);
    expect(result.extractionIssues).toContain('No specifications found');
    expect(result.facts).toHaveLength(0);
  });

  it('returns null facts when labels are missing', () => {
    const result = extractCpuFacts(MISSING_SOCKET_CPU);
    const socketFact = result.facts.find((f) => f.key === 'cpu.socket');
    expect(socketFact?.value).toBeNull();
    expect(socketFact?.evidence[0]?.extractionIssues.length).toBeGreaterThan(0);
  });

  it('handles malformed TDP gracefully', () => {
    const result = extractCpuFacts(MALFORMED_TDP_CPU);
    const tdpFact = result.facts.find((f) => f.key === 'cpu.tdpWatts');
    expect(tdpFact?.value).toBeNull();
  });

  it('interprets known iGPU model name as present', () => {
    const result = extractCpuFacts(IGPU_PRESENT_CPU);
    const igpuFact = result.facts.find((f) => f.key === 'cpu.iGpu');
    expect(igpuFact?.value).toBe(true);
  });

  it('treats empty iGPU value as null (unknown)', () => {
    const result = extractCpuFacts(IGPU_EMPTY_CPU);
    const igpuFact = result.facts.find((f) => f.key === 'cpu.iGpu');
    expect(igpuFact?.value).toBeNull();
  });

  it('treats "Unknown" iGPU as null (not true)', () => {
    const result = extractCpuFacts(IGPU_UNKNOWN_CPU);
    const igpuFact = result.facts.find((f) => f.key === 'cpu.iGpu');
    expect(igpuFact?.value).toBeNull();
    expect(
      igpuFact?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('Unrecognized'),
      ),
    ).toBe(true);
  });

  it('treats "N/A" iGPU as false (negative set)', () => {
    const result = extractCpuFacts(IGPU_NA_CPU);
    const igpuFact = result.facts.find((f) => f.key === 'cpu.iGpu');
    expect(igpuFact?.value).toBe(false);
  });

  it('recognizes Intel UHD 770 as present', () => {
    const result = extractCpuFacts(IGPU_UHD_CPU);
    const igpuFact = result.facts.find((f) => f.key === 'cpu.iGpu');
    expect(igpuFact?.value).toBe(true);
  });

  it('recognizes AMD Radeon Graphics as present', () => {
    const result = extractCpuFacts(IGPU_RADEON_CPU);
    const igpuFact = result.facts.find((f) => f.key === 'cpu.iGpu');
    expect(igpuFact?.value).toBe(true);
  });

  it('treats ambiguous iGPU value as null', () => {
    const result = extractCpuFacts(IGPU_AMBIGUOUS_CPU);
    const igpuFact = result.facts.find((f) => f.key === 'cpu.iGpu');
    expect(igpuFact?.value).toBeNull();
    expect(
      igpuFact?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('Unrecognized'),
      ),
    ).toBe(true);
  });

  it('returns null iGpu when label is missing', () => {
    const result = extractCpuFacts(NO_IGPU_LABEL_CPU);
    const igpuFact = result.facts.find((f) => f.key === 'cpu.iGpu');
    expect(igpuFact?.value).toBeNull();
    expect(
      igpuFact?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('not found'),
      ),
    ).toBe(true);
  });

  it('does not mutate input', () => {
    const original = [...RYZEN_7700X];
    extractCpuFacts(RYZEN_7700X);
    expect(RYZEN_7700X).toEqual(original);
  });

  it('produces deterministic facts (same input → same facts)', () => {
    const result1 = extractCpuFacts(RYZEN_7700X);
    const result2 = extractCpuFacts(RYZEN_7700X);
    // Compare facts (not extractedAt which varies)
    expect(result1.facts).toEqual(result2.facts);
  });

  it('every extracted fact has evidence with required fields', () => {
    const result = extractCpuFacts(I7_13700K);
    for (const fact of result.facts) {
      expect(fact.evidence.length).toBeGreaterThan(0);
      for (const ev of fact.evidence) {
        expect(typeof ev.sourceLabel).toBe('string');
        expect(typeof ev.rawValue).toBe('string');
        expect(typeof ev.confidence).toBe('number');
        expect(typeof ev.extractorVersion).toBe('string');
        expect(Array.isArray(ev.extractionIssues)).toBe(true);
      }
    }
  });
});
