import { describe, it, expect } from 'vitest';
import { extractMotherboardFacts } from '../extractors/motherboard.js';
import {
  B650E_F,
  B760M_MORTAR,
  B550M_DS3H,
  EMPTY_MB,
  SODIMM_MB,
  CONFLICT_SOCKET_MB,
  CONFLICT_FF_MB,
  LIVE_CPU_SUPPORT_MB,
  LIVE_MAX_MEMORY_SUPPORT_MB,
  LIVE_GENERIC_FF_MB,
} from '../__fixtures__/motherboard.js';

describe('extractMotherboardFacts', () => {
  it('extracts all facts from B650E-F', () => {
    const result = extractMotherboardFacts(B650E_F);

    expect(result.category).toBe('Motherboard');
    expect(result.extractorVersion).toBe('mb/v1.1.0');

    expect(result.facts.find((f) => f.key === 'mb.socket')?.value).toBe('AM5');
    expect(result.facts.find((f) => f.key === 'mb.chipset')?.value).toBe('B650E');
    expect(result.facts.find((f) => f.key === 'mb.formFactor')?.value).toBe('ATX');
    expect(result.facts.find((f) => f.key === 'mb.ramGeneration')?.value).toBe('DDR5');
    expect(result.facts.find((f) => f.key === 'mb.dimmSlots')?.value).toBe(4);
    expect(result.facts.find((f) => f.key === 'mb.maxMemoryGB')?.value).toBe(128);
    expect(result.facts.find((f) => f.key === 'mb.maxMemorySpeedMHz')?.value).toBe(5600);
    expect(result.facts.find((f) => f.key === 'mb.sataPorts')?.value).toBe(6);
    expect(result.facts.find((f) => f.key === 'mb.m2Slots')?.value).toBe(2);
    expect(result.facts.find((f) => f.key === 'mb.m2FormFactors')?.value).toEqual(['2280', '2242']);
  });

  it('normalizes "Micro ATX" to "Micro-ATX"', () => {
    const result = extractMotherboardFacts(B760M_MORTAR);
    expect(result.facts.find((f) => f.key === 'mb.formFactor')?.value).toBe('Micro-ATX');
  });

  it('normalizes "mATX" to "Micro-ATX"', () => {
    const result = extractMotherboardFacts(B550M_DS3H);
    expect(result.facts.find((f) => f.key === 'mb.formFactor')?.value).toBe('Micro-ATX');
  });

  it('extracts DDR4 generation', () => {
    const result = extractMotherboardFacts(B550M_DS3H);
    expect(result.facts.find((f) => f.key === 'mb.ramGeneration')?.value).toBe('DDR4');
  });

  it('extracts DDR5 SO-DIMM module type', () => {
    const result = extractMotherboardFacts(SODIMM_MB);
    expect(result.facts.find((f) => f.key === 'mb.ramType')?.value).toBe('SO-DIMM');
    expect(result.facts.find((f) => f.key === 'mb.ramGeneration')?.value).toBe('DDR5');
  });

  it('extracts DIMM module type from compound value "DDR5 DIMM"', () => {
    const result = extractMotherboardFacts(B760M_MORTAR);
    expect(result.facts.find((f) => f.key === 'mb.ramType')?.value).toBe('DIMM');
  });

  it('returns null facts for empty specs', () => {
    const result = extractMotherboardFacts(EMPTY_MB);
    expect(result.extractionIssues).toContain('No specifications found');
    expect(result.facts).toHaveLength(0);
  });

  it('handles "128GB" without space', () => {
    const result = extractMotherboardFacts(B550M_DS3H);
    expect(result.facts.find((f) => f.key === 'mb.maxMemoryGB')?.value).toBe(128);
  });

  it('does not mutate input', () => {
    const original = [...B650E_F];
    extractMotherboardFacts(B650E_F);
    expect(B650E_F).toEqual(original);
  });

  it('every fact has evidence', () => {
    const result = extractMotherboardFacts(B650E_F);
    for (const fact of result.facts) {
      expect(fact.evidence.length).toBeGreaterThan(0);
    }
  });

  it('returns null socket when duplicate labels disagree', () => {
    const result = extractMotherboardFacts(CONFLICT_SOCKET_MB);
    const socketFact = result.facts.find((f) => f.key === 'mb.socket');
    expect(socketFact?.value).toBeNull();
    expect(
      socketFact?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('onflict'),
      ),
    ).toBe(true);
    // Other facts should still extract normally
    expect(result.facts.find((f) => f.key === 'mb.chipset')?.value).toBe('B650');
    expect(result.facts.find((f) => f.key === 'mb.formFactor')?.value).toBe('ATX');
  });

  it('returns null formFactor when duplicate labels disagree', () => {
    const result = extractMotherboardFacts(CONFLICT_FF_MB);
    const ffFact = result.facts.find((f) => f.key === 'mb.formFactor');
    expect(ffFact?.value).toBeNull();
    expect(
      ffFact?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('onflict'),
      ),
    ).toBe(true);
    // Other facts should still extract normally
    expect(result.facts.find((f) => f.key === 'mb.socket')?.value).toBe('AM5');
    expect(result.facts.find((f) => f.key === 'mb.chipset')?.value).toBe('B650');
  });

  // ---- Regression: live Atlas trace bugs ----

  it('extracts socket from "CPU Support" label (live bug)', () => {
    const result = extractMotherboardFacts(LIVE_CPU_SUPPORT_MB);
    const socket = result.facts.find((f) => f.key === 'mb.socket');
    expect(socket?.value).toBe('AM5');
    expect(socket?.evidence[0]?.sourceLabel).toBe('CPU Support');
  });

  it('extracts DDR generation from "Max Memory support: 256GB DDR5" (live bug)', () => {
    const result = extractMotherboardFacts(LIVE_MAX_MEMORY_SUPPORT_MB);
    expect(result.facts.find((f) => f.key === 'mb.ramGeneration')?.value).toBe('DDR5');
  });

  it('extracts maxMemoryGB=256 from "Max Memory support: 256GB DDR5" (live bug)', () => {
    const result = extractMotherboardFacts(LIVE_MAX_MEMORY_SUPPORT_MB);
    expect(result.facts.find((f) => f.key === 'mb.maxMemoryGB')?.value).toBe(256);
  });

  it('does NOT set ramType from compound "Max Memory support" value (no DIMM evidence)', () => {
    const result = extractMotherboardFacts(LIVE_MAX_MEMORY_SUPPORT_MB);
    // No DIMM/SODIMM in "256GB DDR5" → ramType must be null
    const ramType = result.facts.find((f) => f.key === 'mb.ramType');
    expect(ramType?.value).toBeNull();
  });

  it('generic "Form Factor" does NOT populate m2FormFactors (live bug)', () => {
    const result = extractMotherboardFacts(LIVE_GENERIC_FF_MB);
    const m2ff = result.facts.find((f) => f.key === 'mb.m2FormFactors');
    // Must be the legitimate M.2 Form Factors value, not the generic Form Factor value
    expect(m2ff?.value).toEqual(['2280', '2242']);
    expect(m2ff?.evidence[0]?.sourceLabel).toBe('M.2 Form Factors');
  });

  it('legitimate M.2 Form Factors extraction still works', () => {
    const result = extractMotherboardFacts(B650E_F);
    const m2ff = result.facts.find((f) => f.key === 'mb.m2FormFactors');
    expect(m2ff?.value).toEqual(['2280', '2242']);
  });
});
