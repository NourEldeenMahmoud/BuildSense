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
} from '../__fixtures__/gpu.js';

describe('extractGpuFacts', () => {
  it('extracts all facts from RTX 4070 Ti', () => {
    const result = extractGpuFacts(RTX_4070_TI);

    expect(result.category).toBe('GPU');
    expect(result.extractorVersion).toBe('gpu/v1.0.0');

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
});
