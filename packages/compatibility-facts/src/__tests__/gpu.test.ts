import { describe, it, expect } from 'vitest';
import { extractGpuFacts } from '../extractors/gpu.js';
import {
  RTX_4070_TI,
  RX_7800_XT,
  RTX_4060,
  EMPTY_GPU,
  DUAL_CONNECTOR_GPU,
  GPU_RECOMMENDED_PSU_ONLY,
  CONFLICT_POWER_GPU,
  LIVE_MODEL_NUMBER_GPU,
  LIVE_UNICODE_CONNECTOR_GPU,
  LIVE_NO_BOARD_POWER_GPU,
  LIVE_SIGMA_SINGULAR_CONNECTOR_LABEL,
} from '../__fixtures__/gpu.js';

describe('extractGpuFacts', () => {
  it('extracts all facts from RTX 4070 Ti', () => {
    const result = extractGpuFacts(RTX_4070_TI);

    expect(result.category).toBe('GPU');
    expect(result.extractorVersion).toBe('gpu/v1.2.0');

    expect(result.facts.find((f) => f.key === 'gpu.lengthMM')?.value).toBe(300);
    expect(result.facts.find((f) => f.key === 'gpu.slotWidth')?.value).toBe(2.5);
    expect(result.facts.find((f) => f.key === 'gpu.connectorTypes')?.value).toEqual(['12VHPWR']);
    expect(result.facts.find((f) => f.key === 'gpu.connectorCount')?.value).toBe(1);
    expect(result.facts.find((f) => f.key === 'gpu.boardPowerWatts')?.value).toBe(285);
  });

  it('extracts facts from RX 7800 XT with dual 8-pin', () => {
    const result = extractGpuFacts(RX_7800_XT);
    expect(result.facts.find((f) => f.key === 'gpu.lengthMM')?.value).toBe(267);
    expect(result.facts.find((f) => f.key === 'gpu.slotWidth')?.value).toBe(2);
    expect(result.facts.find((f) => f.key === 'gpu.connectorTypes')?.value).toEqual([
      '8-pin',
      '8-pin',
    ]);
    expect(result.facts.find((f) => f.key === 'gpu.connectorCount')?.value).toBe(2);
    expect(result.facts.find((f) => f.key === 'gpu.boardPowerWatts')?.value).toBe(263);
  });

  it('extracts facts from RTX 4060', () => {
    const result = extractGpuFacts(RTX_4060);
    expect(result.facts.find((f) => f.key === 'gpu.lengthMM')?.value).toBe(240);
    expect(result.facts.find((f) => f.key === 'gpu.slotWidth')?.value).toBe(2);
    expect(result.facts.find((f) => f.key === 'gpu.connectorTypes')?.value).toEqual(['8-pin']);
    expect(result.facts.find((f) => f.key === 'gpu.boardPowerWatts')?.value).toBe(115);
  });

  it('parses "1x 8-pin + 1x 6-pin" dual connectors', () => {
    const result = extractGpuFacts(DUAL_CONNECTOR_GPU);
    expect(result.facts.find((f) => f.key === 'gpu.connectorTypes')?.value).toEqual([
      '8-pin',
      '6-pin',
    ]);
    expect(result.facts.find((f) => f.key === 'gpu.connectorCount')?.value).toBe(2);
    expect(result.facts.find((f) => f.key === 'gpu.lengthMM')?.value).toBe(330);
    expect(result.facts.find((f) => f.key === 'gpu.slotWidth')?.value).toBe(3);
  });

  it('does not extract "Recommended PSU" as board power', () => {
    const result = extractGpuFacts(GPU_RECOMMENDED_PSU_ONLY);
    expect(result.facts.find((f) => f.key === 'gpu.lengthMM')?.value).toBe(240);
    expect(result.facts.find((f) => f.key === 'gpu.slotWidth')?.value).toBe(2);
    expect(result.facts.find((f) => f.key === 'gpu.connectorTypes')?.value).toEqual(['8-pin']);
    // "Recommended PSU" should NOT match boardPowerWatts
    const boardPower = result.facts.find((f) => f.key === 'gpu.boardPowerWatts');
    expect(boardPower?.value).toBeNull();
    expect(
      boardPower?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('not found'),
      ),
    ).toBe(true);
  });

  it('returns null boardPower when conflicting power labels disagree', () => {
    const result = extractGpuFacts(CONFLICT_POWER_GPU);
    const boardPower = result.facts.find((f) => f.key === 'gpu.boardPowerWatts');
    expect(boardPower?.value).toBeNull();
    expect(
      boardPower?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('Conflicting'),
      ),
    ).toBe(true);
    // Other facts should still extract normally
    expect(result.facts.find((f) => f.key === 'gpu.lengthMM')?.value).toBe(300);
  });

  it('returns null facts for empty specs', () => {
    const result = extractGpuFacts(EMPTY_GPU);
    expect(result.extractionIssues).toContain('No specifications found');
    expect(result.facts).toHaveLength(0);
  });

  it('does not mutate input', () => {
    const original = [...RTX_4070_TI];
    extractGpuFacts(RTX_4070_TI);
    expect(RTX_4070_TI).toEqual(original);
  });

  // ---- Regression: live Atlas trace bugs ----

  it('GPU model number "AMD Radeon RX 6900 XT" does NOT yield lengthMM (live bug)', () => {
    const result = extractGpuFacts(LIVE_MODEL_NUMBER_GPU);
    // The "GPU" label must not match LENGTH_LABELS, and even if it did,
    // the model number must not be parsed as a dimension.
    const lengthFact = result.facts.find((f) => f.key === 'gpu.lengthMM');
    expect(lengthFact?.value).toBe(267); // from the legitimate "Length" label
  });

  it('actual dimension "267 mm" still extracts lengthMM correctly', () => {
    const result = extractGpuFacts(LIVE_MODEL_NUMBER_GPU);
    expect(result.facts.find((f) => f.key === 'gpu.lengthMM')?.value).toBe(267);
  });

  it('Unicode × in "2 × PCI-E 8-Pin" extracts connectorCount=2 (live bug)', () => {
    const result = extractGpuFacts(LIVE_UNICODE_CONNECTOR_GPU);
    expect(result.facts.find((f) => f.key === 'gpu.connectorCount')?.value).toBe(2);
  });

  it('Unicode × preserves canonical connector type extraction', () => {
    const result = extractGpuFacts(LIVE_UNICODE_CONNECTOR_GPU);
    expect(result.facts.find((f) => f.key === 'gpu.connectorTypes')?.value).toEqual([
      'PCI-E 8-Pin',
      'PCI-E 8-Pin',
    ]);
  });

  it('ASCII "x" connector count remains supported', () => {
    const result = extractGpuFacts(DUAL_CONNECTOR_GPU);
    expect(result.facts.find((f) => f.key === 'gpu.connectorCount')?.value).toBe(2);
    expect(result.facts.find((f) => f.key === 'gpu.connectorTypes')?.value).toEqual([
      '8-pin',
      '6-pin',
    ]);
  });

  it('absent board power remains null (source-data limitation)', () => {
    const result = extractGpuFacts(LIVE_NO_BOARD_POWER_GPU);
    const boardPower = result.facts.find((f) => f.key === 'gpu.boardPowerWatts');
    expect(boardPower?.value).toBeNull();
    expect(
      boardPower?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('not found'),
      ),
    ).toBe(true);
  });

  // ---- Regression: singular Sigma label (v1.2) ----

  it('singular "Power Connector" label extracts connector facts (live Sigma label)', () => {
    const result = extractGpuFacts(LIVE_SIGMA_SINGULAR_CONNECTOR_LABEL);
    expect(result.extractorVersion).toBe('gpu/v1.2.0');
    expect(result.facts.find((f) => f.key === 'gpu.connectorTypes')?.value).toEqual([
      'PCI-E 8-Pin',
      'PCI-E 8-Pin',
    ]);
    expect(result.facts.find((f) => f.key === 'gpu.connectorCount')?.value).toBe(2);
    // Evidence should show the original singular label with alias confidence
    const evidence = result.facts.find((f) => f.key === 'gpu.connectorTypes')
      ?.evidence[0];
    expect(evidence?.sourceLabel).toBe('Power Connector');
    expect(evidence?.confidence).toBe(0.9);
  });
});
