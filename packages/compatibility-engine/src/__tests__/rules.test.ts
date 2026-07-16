import { describe, expect, it } from 'vitest';
import type { BuildSlot, CategoryQualityReport } from '@buildsense/domain';
import { CompatibilityEngine } from '../engine.js';
import { passesFactQualityGate } from '../gates.js';
import { createDefaultCompatibilityEngine } from '../registry.js';
import { activateRule, RULE_DEFINITIONS } from '../rules.js';

function facts(entries: Partial<Record<BuildSlot, Record<string, unknown>>>): ReadonlyMap<BuildSlot, Record<string, unknown>> {
  return new Map(Object.entries(entries) as [BuildSlot, Record<string, unknown>][]);
}

function evaluateRule(id: string, buildFacts: ReadonlyMap<BuildSlot, Record<string, unknown>>) {
  const definition = RULE_DEFINITIONS.find((rule) => rule.id === id);
  if (!definition) throw new Error(`Missing rule ${id}`);
  const engine = new CompatibilityEngine();
  engine.register(activateRule(definition, true));
  return engine.evaluate(buildFacts, [definition.requiredSlots[0] ?? 'cpu']).slots[0];
}

function qualityReport(category: string, factKeys: readonly string[]): CategoryQualityReport {
  return {
    category,
    extractorVersion: `${category.toLowerCase()}/v1.0.0`,
    totalProducts: 50,
    factMetrics: factKeys.map((factKey) => ({
      factKey,
      extractableCount: 50,
      coverage: 1,
      verifiedCorrect: 50,
      verifiedSampleSize: 50,
      precision: 1,
    })),
    allGatesPass: true,
    evaluatedAt: new Date(0).toISOString(),
  };
}

describe('typed compatibility rules', () => {
  it.each([
    ['CMP-CPU-MB-001', { cpu: { 'cpu.socket': 'AM5' }, motherboard: { 'mb.socket': 'AM5' } }, 'COMPATIBLE'],
    ['CMP-CPU-MB-001', { cpu: { 'cpu.socket': 'AM5' }, motherboard: { 'mb.socket': 'LGA1700' } }, 'INCOMPATIBLE'],
    ['CMP-MB-RAM-001', { ram: { 'ram.generation': 'DDR5' }, motherboard: { 'mb.ramGeneration': 'DDR5' } }, 'COMPATIBLE'],
    ['CMP-MB-RAM-002', { ram: { 'ram.moduleType': 'SODIMM' }, motherboard: { 'mb.ramType': 'DIMM' } }, 'INCOMPATIBLE'],
    ['CMP-MB-RAM-003', { ram: { 'ram.moduleCount': 4 }, motherboard: { 'mb.dimmSlots': 2 } }, 'INCOMPATIBLE'],
    ['CMP-MB-RAM-004', { ram: { 'ram.capacityGB': 64 }, motherboard: { 'mb.maxMemoryGB': 128 } }, 'COMPATIBLE'],
    ['CMP-MB-RAM-005', { ram: { 'ram.speedMHz': 6400 }, motherboard: { 'mb.maxMemorySpeedMHz': 6000 } }, 'WARNING'],
    ['CMP-GPU-CASE-001', { gpu: { 'gpu.lengthMM': 330 }, case: { 'case.maxGpuLengthMM': 300 } }, 'INCOMPATIBLE'],
    ['CMP-GPU-CASE-002', { gpu: { 'gpu.slotWidth': 3 }, case: { 'case.expansionSlots': 7 } }, 'COMPATIBLE'],
  ] as const)('%s returns %s', (id, input, expected) => {
    expect(evaluateRule(id, facts(input))?.status).toBe(expected);
  });

  it('returns UNKNOWN when a required fact is missing', () => {
    expect(evaluateRule('CMP-CPU-MB-001', facts({ cpu: { 'cpu.socket': 'AM5' } }))?.status).toBe('UNKNOWN');
  });

  it('evaluates motherboard form-factor support', () => {
    const result = evaluateRule('CMP-MB-CASE-001', facts({
      motherboard: { 'mb.formFactor': 'ATX' },
      case: { 'case.supportedFormFactors': ['ATX', 'Micro-ATX'] },
    }));
    expect(result?.status).toBe('COMPATIBLE');
  });

  it.each([
    [500, 'INCOMPATIBLE'],
    [600, 'WARNING'],
    [660, 'COMPATIBLE'],
  ] as const)('applies PSU headroom thresholds at %sW', (wattage, expected) => {
    const result = evaluateRule('CMP-PSU-001', facts({
      cpu: { 'cpu.tdpWatts': 150 },
      gpu: { 'gpu.boardPowerWatts': 300 },
      psu: { 'psu.wattage': wattage },
    }));
    expect(result?.status).toBe(expected);
  });

  it('evaluates storage interface ports', () => {
    expect(evaluateRule('CMP-STORAGE-MB-001', facts({
      storage: { 'storage.interface': 'NVMe' },
      motherboard: { 'mb.m2Slots': 1, 'mb.sataPorts': 0 },
    }))?.status).toBe('COMPATIBLE');
  });

  it('requires display capability when no dedicated GPU is present', () => {
    expect(evaluateRule('CMP-GRAPHICS-001', facts({ cpu: { 'cpu.iGpu': false } }))?.status).toBe('INCOMPATIBLE');
    expect(evaluateRule('CMP-GRAPHICS-001', facts({ cpu: { 'cpu.iGpu': true } }))?.status).toBe('COMPATIBLE');
  });

  it('keeps reference and unavailable connector rules UNKNOWN', () => {
    expect(evaluateRule('CMP-CPU-MB-002', facts({ cpu: { 'cpu.family': 'Ryzen 7000' }, motherboard: { 'mb.chipset': 'B650' } }))?.status).toBe('UNKNOWN');
    expect(evaluateRule('CMP-PSU-GPU-001', facts({ gpu: { 'gpu.connectorCount': 1 } }))?.status).toBe('UNKNOWN');
  });
});

describe('activation gates and candidate classification', () => {
  it('fails quality gates without verified precision', () => {
    const report = qualityReport('CPU', ['cpu.socket']);
    const unverified = { ...report, factMetrics: [{ ...report.factMetrics[0]!, precision: null, verifiedCorrect: null, verifiedSampleSize: null }] };
    expect(passesFactQualityGate([unverified], 'CPU', 'cpu.socket')).toBe(false);
  });

  it('registers all active-scope rules but activates only quality-approved rules', () => {
    const engine = createDefaultCompatibilityEngine({
      qualityReports: [qualityReport('CPU', ['cpu.socket']), qualityReport('Motherboard', ['mb.socket'])],
    });
    expect(engine.getAllRules()).toHaveLength(14);
    expect(engine.getRulesForSlot('cpu').map((rule) => rule.id)).toContain('CMP-CPU-MB-001');
    expect(engine.getRulesForSlot('cpu').map((rule) => rule.id)).not.toContain('CMP-CPU-MB-002');
  });

  it('classifies candidates into compatible, warning, incompatible, and unknown groups', () => {
    const definition = RULE_DEFINITIONS.find((rule) => rule.id === 'CMP-MB-RAM-005')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));
    const base = facts({ motherboard: { 'mb.maxMemorySpeedMHz': 6000 } });
    expect(engine.classifyCandidate('ram', { 'ram.speedMHz': 5600 }, base)).toBe('COMPATIBLE');
    expect(engine.classifyCandidate('ram', { 'ram.speedMHz': 6400 }, base)).toBe('COMPATIBLE_WITH_WARNINGS');
    expect(engine.classifyCandidate('ram', {}, base)).toBe('UNKNOWN');

    const socket = RULE_DEFINITIONS.find((rule) => rule.id === 'CMP-CPU-MB-001')!;
    const socketEngine = new CompatibilityEngine();
    socketEngine.register(activateRule(socket, true));
    expect(socketEngine.classifyCandidate('cpu', { 'cpu.socket': 'AM4' }, facts({ motherboard: { 'mb.socket': 'AM5' } }))).toBe('INCOMPATIBLE');
  });

  it('includes rule reasons in build and candidate results', () => {
    const definition = RULE_DEFINITIONS.find((rule) => rule.id === 'CMP-CPU-MB-001')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));
    const buildFacts = facts({ cpu: { 'cpu.socket': 'AM4' }, motherboard: { 'mb.socket': 'AM5' } });
    const buildResult = engine.evaluate(buildFacts, ['cpu']);
    expect(buildResult.slots[0]?.topReasons[0]).toContain('does not match');
    expect(engine.classifyCandidateWithReasons('cpu', { 'cpu.socket': 'AM4' }, buildFacts).topReasons[0]).toContain('does not match');
  });
});
