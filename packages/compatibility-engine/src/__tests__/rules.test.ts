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

// ---------------------------------------------------------------------------
// missingFactKeys on rules
// ---------------------------------------------------------------------------

describe('rule missingFactKeys', () => {
  function evaluateRuleWithMissing(id: string, buildFacts: ReadonlyMap<BuildSlot, Record<string, unknown>>) {
    const definition = RULE_DEFINITIONS.find((rule) => rule.id === id);
    if (!definition) throw new Error(`Missing rule ${id}`);
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));
    return engine.evaluate(buildFacts, [definition.requiredSlots[0] ?? 'cpu']).slots[0];
  }

  it('CMP-CPU-MB-001: returns empty when both sockets present', () => {
    const result = evaluateRuleWithMissing('CMP-CPU-MB-001', facts({ cpu: { 'cpu.socket': 'AM5' }, motherboard: { 'mb.socket': 'AM5' } }));
    expect(result?.status).toBe('COMPATIBLE');
    expect(result?.missingFactKeys).toEqual([]);
  });

  it('CMP-CPU-MB-001: returns empty when sockets mismatch (INCOMPATIBLE)', () => {
    const result = evaluateRuleWithMissing('CMP-CPU-MB-001', facts({ cpu: { 'cpu.socket': 'AM4' }, motherboard: { 'mb.socket': 'AM5' } }));
    expect(result?.status).toBe('INCOMPATIBLE');
    expect(result?.missingFactKeys).toEqual([]);
  });

  it('CMP-CPU-MB-001: reports cpu.socket when motherboard socket absent', () => {
    // Only cpu.socket present, mb.socket absent (no motherboard slot)
    const result = evaluateRuleWithMissing('CMP-CPU-MB-001', facts({ cpu: { 'cpu.socket': 'AM5' } }));
    expect(result?.status).toBe('UNKNOWN');
    expect(result?.missingFactKeys).toEqual(['mb.socket']);
  });

  it('CMP-CPU-MB-001: reports both keys when both absent', () => {
    const result = evaluateRuleWithMissing('CMP-CPU-MB-001', facts({}));
    expect(result?.status).toBe('UNKNOWN');
    expect(result?.missingFactKeys).toEqual(['cpu.socket', 'mb.socket']);
  });

  it('CMP-MB-RAM-001: reports missing generation keys', () => {
    const result = evaluateRuleWithMissing('CMP-MB-RAM-001', facts({ ram: { 'ram.generation': 'DDR5' } }));
    expect(result?.status).toBe('UNKNOWN');
    expect(result?.missingFactKeys).toEqual(['mb.ramGeneration']);
  });

  it('CMP-MB-RAM-003: reports missing maximumRule keys', () => {
    const result = evaluateRuleWithMissing('CMP-MB-RAM-003', facts({ ram: { 'ram.moduleCount': 4 } }));
    expect(result?.status).toBe('UNKNOWN');
    expect(result?.missingFactKeys).toEqual(['mb.dimmSlots']);
  });

  it('CMP-MB-CASE-001: reports missing form factor keys', () => {
    const result = evaluateRuleWithMissing('CMP-MB-CASE-001', facts({ motherboard: { 'mb.formFactor': 'ATX' } }));
    expect(result?.status).toBe('UNKNOWN');
    expect(result?.missingFactKeys).toEqual(['case.supportedFormFactors']);
  });

  it('CMP-MB-CASE-001: UNKNOWN when case slot missing returns null reason — no misleading "does not support"', () => {
    // MB selected, no case counterpart at all → UNKNOWN with missingFactKeys, not INCOMPATIBLE wording
    const result = evaluateRuleWithMissing('CMP-MB-CASE-001', facts({ motherboard: { 'mb.formFactor': 'Micro-ATX' } }));
    expect(result?.status).toBe('UNKNOWN');
    expect(result?.missingFactKeys).toEqual(['case.supportedFormFactors']);
    expect(result?.topReasons.join(' ')).not.toContain('does not support');
  });

  it('CMP-MB-CASE-001: UNKNOWN when case slot present but has no facts — no "does not support"', () => {
    // Case slot exists but is empty → UNKNOWN, honest missing-fact reason, no misleading negative
    const result = evaluateRuleWithMissing('CMP-MB-CASE-001', facts({
      motherboard: { 'mb.formFactor': 'Micro-ATX' },
      case: {},
    }));
    expect(result?.status).toBe('UNKNOWN');
    expect(result?.missingFactKeys).toEqual(['case.supportedFormFactors']);
    expect(result?.topReasons.join(' ')).not.toContain('does not support');
  });

  it('CMP-MB-CASE-001: INCOMPATIBLE when case explicitly does not support form factor — "does not support" + rule ID', () => {
    // Actual conflicting facts → INCOMPATIBLE with the correct negative wording
    const result = evaluateRuleWithMissing('CMP-MB-CASE-001', facts({
      motherboard: { 'mb.formFactor': 'Micro-ATX' },
      case: { 'case.supportedFormFactors': ['ATX', 'E-ATX'] },
    }));
    expect(result?.status).toBe('INCOMPATIBLE');
    expect(result?.topReasons.join(' ')).toContain('does not support');
    expect(result?.missingFactKeys).toEqual([]);
  });

  it('CMP-PSU-001: reports all missing keys across three slots', () => {
    const result = evaluateRuleWithMissing('CMP-PSU-001', facts({ psu: { 'psu.wattage': 750 } }));
    expect(result?.status).toBe('UNKNOWN');
    expect(result?.missingFactKeys).toEqual(['cpu.tdpWatts', 'gpu.boardPowerWatts']);
  });

  it('CMP-GRAPHICS-001: reports cpu.iGpu when no GPU and no iGpu fact', () => {
    const result = evaluateRuleWithMissing('CMP-GRAPHICS-001', facts({ cpu: {} }));
    expect(result?.status).toBe('UNKNOWN');
    expect(result?.missingFactKeys).toEqual(['cpu.iGpu']);
  });

  it('CMP-GRAPHICS-001: returns empty when GPU present', () => {
    const result = evaluateRuleWithMissing('CMP-GRAPHICS-001', facts({ gpu: { 'gpu.lengthMM': 300 } }));
    expect(result?.status).toBe('COMPATIBLE');
    expect(result?.missingFactKeys).toEqual([]);
  });

  it('stub rules have no missingFactKeys method', () => {
    const stub = RULE_DEFINITIONS.find((r) => r.id === 'CMP-CPU-MB-002')!;
    expect('missingFactKeys' in stub).toBe(false);
    const stub2 = RULE_DEFINITIONS.find((r) => r.id === 'CMP-PSU-GPU-001')!;
    expect('missingFactKeys' in stub2).toBe(false);
  });
});

describe('activation gates and candidate classification', () => {
  it('fails quality gates without verified precision', () => {
    const report = qualityReport('CPU', ['cpu.socket']);
    const unverified = { ...report, factMetrics: [{ ...report.factMetrics[0]!, precision: null, verifiedCorrect: null, verifiedSampleSize: null }] };
    expect(passesFactQualityGate([unverified], 'CPU', 'cpu.socket')).toBe(false);
  });

  it('registers all 14 rules; activates implemented rules unconditionally', () => {
    const engine = createDefaultCompatibilityEngine();
    expect(engine.getAllRules()).toHaveLength(14);

    // Implemented socket rule — always active
    expect(engine.getRulesForSlot('cpu').map((rule) => rule.id)).toContain('CMP-CPU-MB-001');

    // Reference-data rule — inactive without dataset
    const allIds = engine.getAllRules().map((r) => r.id);
    expect(allIds).toContain('CMP-CPU-MB-002');
    const cpuMb002 = engine.getAllRules().find((r) => r.id === 'CMP-CPU-MB-002')!;
    expect(cpuMb002.active).toBe(false);

    // Stub rule — always inactive
    const psuGpu001 = engine.getAllRules().find((r) => r.id === 'CMP-PSU-GPU-001')!;
    expect(psuGpu001.active).toBe(false);

    // All other implemented rules should be active
    for (const rule of engine.getAllRules()) {
      if (rule.id === 'CMP-CPU-MB-002' || rule.id === 'CMP-PSU-GPU-001') continue;
      expect(rule.active).toBe(true);
    }
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

// ---------------------------------------------------------------------------
// Focused regression tests: quality reports do NOT gate runtime rules
// ---------------------------------------------------------------------------

describe('quality reports do not disable runtime rules', () => {
  it('CMP-CPU-MB-001 is active even with zero total products in quality report', () => {
    const zeroReport: CategoryQualityReport = {
      category: 'CPU',
      extractorVersion: 'unknown/0.0.0',
      totalProducts: 0,
      factMetrics: [
        { factKey: 'cpu.socket', extractableCount: 0, coverage: 0, verifiedCorrect: null, verifiedSampleSize: null, precision: null },
      ],
      allGatesPass: false,
      evaluatedAt: new Date(0).toISOString(),
    };
    const engine = createDefaultCompatibilityEngine({ qualityReports: [zeroReport] });
    const cpuRule = engine.getAllRules().find((r) => r.id === 'CMP-CPU-MB-001')!;
    expect(cpuRule.active).toBe(true);
  });

  it('CMP-CPU-MB-001 is active even when no quality reports exist at all', () => {
    const engine = createDefaultCompatibilityEngine({});
    const cpuRule = engine.getAllRules().find((r) => r.id === 'CMP-CPU-MB-001')!;
    expect(cpuRule.active).toBe(true);
  });

  it('low-sample quality report does not disable any implemented rule', () => {
    const lowSampleReport: CategoryQualityReport = {
      category: 'CPU',
      extractorVersion: 'cpu/v1.0.0',
      totalProducts: 5,
      factMetrics: [
        { factKey: 'cpu.socket', extractableCount: 3, coverage: 0.6, verifiedCorrect: 3, verifiedSampleSize: 3, precision: 1 },
      ],
      allGatesPass: false,
      evaluatedAt: new Date(0).toISOString(),
    };
    const mbReport: CategoryQualityReport = {
      category: 'Motherboard',
      extractorVersion: 'mb/v1.0.0',
      totalProducts: 5,
      factMetrics: [
        { factKey: 'mb.socket', extractableCount: 3, coverage: 0.6, verifiedCorrect: 3, verifiedSampleSize: 3, precision: 1 },
      ],
      allGatesPass: false,
      evaluatedAt: new Date(0).toISOString(),
    };
    const engine = createDefaultCompatibilityEngine({
      qualityReports: [lowSampleReport, mbReport],
    });
    // Socket rule must be active
    const cpuRule = engine.getAllRules().find((r) => r.id === 'CMP-CPU-MB-001')!;
    expect(cpuRule.active).toBe(true);
    // Must actually produce COMPATIBLE with real facts
    const result = engine.evaluate(
      facts({ cpu: { 'cpu.socket': 'AM5' }, motherboard: { 'mb.socket': 'AM5' } }),
      ['cpu'],
    );
    expect(result.slots[0]?.status).toBe('COMPATIBLE');
  });

  it('no facts at all does not disable rules globally — rules stay active', () => {
    const engine = createDefaultCompatibilityEngine();
    // All implemented rules are active
    for (const rule of engine.getAllRules()) {
      if (rule.id === 'CMP-CPU-MB-002' || rule.id === 'CMP-PSU-GPU-001') continue;
      expect(rule.active).toBe(true);
    }
    // Empty build evaluates correctly (UNKNOWN due to missing facts, not inactive rules)
    const result = engine.evaluate(new Map(), ['cpu']);
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.topReasons).not.toContain('No active compatibility rule can evaluate this slot.');
  });
});

// ---------------------------------------------------------------------------
// Focused regression tests: persisted-shape fixture scenarios
// ---------------------------------------------------------------------------

describe('persisted-shape fixture regression', () => {
  it('AM5 CPU + AM5 MB → COMPATIBLE with rule ID CMP-CPU-MB-001', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({ cpu: { 'cpu.socket': 'AM5' }, motherboard: { 'mb.socket': 'AM5' } }),
      ['cpu'],
    );
    expect(result.slots[0]?.status).toBe('COMPATIBLE');
    expect(result.slots[0]?.triggeredRuleIds).toContain('CMP-CPU-MB-001');
    expect(result.overallStatus).toBe('COMPATIBLE');
  });

  it('AM4 CPU + AM5 MB → INCOMPATIBLE with same rule ID CMP-CPU-MB-001', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({ cpu: { 'cpu.socket': 'AM4' }, motherboard: { 'mb.socket': 'AM5' } }),
      ['cpu'],
    );
    expect(result.slots[0]?.status).toBe('INCOMPATIBLE');
    expect(result.slots[0]?.triggeredRuleIds).toContain('CMP-CPU-MB-001');
    expect(result.overallStatus).toBe('INCOMPATIBLE');
  });

  it('DDR5 RAM + DDR5 MB → COMPATIBLE via CMP-MB-RAM-001 and CMP-MB-RAM-002', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({
        ram: { 'ram.generation': 'DDR5', 'ram.moduleType': 'DIMM' },
        motherboard: { 'mb.ramGeneration': 'DDR5', 'mb.ramType': 'DIMM' },
      }),
      ['ram'],
    );
    expect(result.slots[0]?.status).toBe('COMPATIBLE');
    expect(result.slots[0]?.triggeredRuleIds).toContain('CMP-MB-RAM-001');
    expect(result.slots[0]?.triggeredRuleIds).toContain('CMP-MB-RAM-002');
  });

  it('CPU with missing cpu.socket fact → UNKNOWN with exact missingFactKeys', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({ cpu: { 'cpu.tdpWatts': 65 }, motherboard: { 'mb.socket': 'AM5' } }),
      ['cpu'],
    );
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.missingFactKeys).toContain('cpu.socket');
    expect(result.slots[0]?.triggeredRuleIds).not.toContain('CMP-CPU-MB-001');
  });

  it('MB with missing mb.socket fact → UNKNOWN with exact missingFactKeys', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({ cpu: { 'cpu.socket': 'AM5' }, motherboard: { 'mb.formFactor': 'ATX' } }),
      ['cpu'],
    );
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.missingFactKeys).toContain('mb.socket');
  });

  it('empty counterpart (no motherboard slot at all) → UNKNOWN with mb.socket missing', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({ cpu: { 'cpu.socket': 'AM5' } }),
      ['cpu'],
    );
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    // mb.socket is missing from CMP-CPU-MB-001; other active rules for 'cpu' also contribute missing keys
    expect(result.slots[0]?.missingFactKeys).toContain('mb.socket');
  });

  it('no facts at all → UNKNOWN with cpu.socket and mb.socket both missing', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(new Map(), ['cpu']);
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    // Both socket keys are missing from CMP-CPU-MB-001
    expect(result.slots[0]?.missingFactKeys).toContain('cpu.socket');
    expect(result.slots[0]?.missingFactKeys).toContain('mb.socket');
  });

  it('unsupported relationship (cooling slot) → honest UNKNOWN no-implemented-rule', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({ cooling: {} }),
      ['cooling'],
    );
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.topReasons).toEqual(['No active compatibility rule can evaluate this slot.']);
    expect(result.slots[0]?.missingFactKeys).toEqual([]);
  });

  it('CMP-MB-CASE-001: MB + missing case slot → UNKNOWN with missingFactKeys, no misleading negative', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({ motherboard: { 'mb.formFactor': 'Micro-ATX', 'mb.socket': 'AM5' } }),
      ['motherboard'],
    );
    // motherboard slot should be UNKNOWN for CMP-MB-CASE-001 since case facts are missing
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.missingFactKeys).toContain('case.supportedFormFactors');
    expect(result.slots[0]?.topReasons.join(' ')).not.toContain('does not support');
  });

  it('CMP-MB-CASE-001: INCOMPATIBLE with conflicting facts contains "does not support" and rule ID', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({
        motherboard: { 'mb.formFactor': 'Micro-ATX', 'mb.socket': 'AM5' },
        case: { 'case.supportedFormFactors': ['ATX', 'E-ATX'] },
      }),
      ['motherboard'],
    );
    expect(result.slots[0]?.status).toBe('INCOMPATIBLE');
    expect(result.slots[0]?.triggeredRuleIds).toContain('CMP-MB-CASE-001');
    expect(result.slots[0]?.topReasons.join(' ')).toContain('does not support');
    expect(result.slots[0]?.missingFactKeys).toEqual([]);
  });

  it('CMP-CPU-MB-002 (CPU family/chipset) remains UNKNOWN without reference data', () => {
    const engine = createDefaultCompatibilityEngine();
    const cpuMb002 = engine.getAllRules().find((r) => r.id === 'CMP-CPU-MB-002')!;
    expect(cpuMb002.active).toBe(false);
    // Even though it's registered, it's inactive → no active rule for CPU family
    // CMP-CPU-MB-001 still fires for socket
    const result = engine.evaluate(
      facts({ cpu: { 'cpu.socket': 'AM5', 'cpu.family': 'Ryzen 7000' }, motherboard: { 'mb.socket': 'AM5', 'mb.chipset': 'B650' } }),
      ['cpu'],
    );
    // Socket rule is COMPATIBLE; family rule is inactive (not UNKNOWN due to missing facts)
    expect(result.slots[0]?.status).toBe('COMPATIBLE');
    expect(result.slots[0]?.triggeredRuleIds).toContain('CMP-CPU-MB-001');
    expect(result.slots[0]?.triggeredRuleIds).not.toContain('CMP-CPU-MB-002');
  });

  it('CMP-PSU-GPU-001 (stub) stays inactive even with all facts present', () => {
    const engine = createDefaultCompatibilityEngine();
    const rule = engine.getAllRules().find((r) => r.id === 'CMP-PSU-GPU-001')!;
    expect(rule.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CMP-MB-CASE-001 missing-counterpart regression:
// UNKNOWN must never include "does not support"; INCOMPATIBLE must include it.
// ---------------------------------------------------------------------------

describe('CMP-MB-CASE-001: missing counterpart semantics', () => {
  it('MB selected, no case slot at all → UNKNOWN, no misleading negative, missingFactKeys present', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({ motherboard: { 'mb.formFactor': 'ATX', 'mb.socket': 'AM5' } }),
      ['motherboard'],
    );
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.missingFactKeys).toContain('case.supportedFormFactors');
    expect(result.slots[0]?.topReasons.join(' ')).not.toContain('does not support');
    // No triggered rules since UNKNOWN with missing facts
    expect(result.slots[0]?.triggeredRuleIds).toEqual([]);
  });

  it('MB selected, case slot empty → UNKNOWN, no misleading negative, missingFactKeys present', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({ motherboard: { 'mb.formFactor': 'Micro-ATX' }, case: {} }),
      ['motherboard'],
    );
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.missingFactKeys).toContain('case.supportedFormFactors');
    expect(result.slots[0]?.topReasons.join(' ')).not.toContain('does not support');
  });

  it('MB selected, case slot present but supportedFormFactors is empty array → INCOMPATIBLE (supports nothing)', () => {
    // Empty array is a valid fact: case supports zero form factors → genuinely incompatible
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({ motherboard: { 'mb.formFactor': 'ITX' }, case: { 'case.supportedFormFactors': [] } }),
      ['motherboard'],
    );
    expect(result.slots[0]?.status).toBe('INCOMPATIBLE');
    expect(result.slots[0]?.triggeredRuleIds).toContain('CMP-MB-CASE-001');
    expect(result.slots[0]?.topReasons.join(' ')).toContain('does not support');
  });

  it('MB selected, case has conflicting form factors → INCOMPATIBLE with rule ID and negative reason', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({
        motherboard: { 'mb.formFactor': 'Mini-ITX', 'mb.socket': 'AM5' },
        case: { 'case.supportedFormFactors': ['ATX', 'E-ATX'] },
      }),
      ['motherboard'],
    );
    expect(result.slots[0]?.status).toBe('INCOMPATIBLE');
    expect(result.slots[0]?.triggeredRuleIds).toContain('CMP-MB-CASE-001');
    expect(result.slots[0]?.topReasons.join(' ')).toContain('does not support');
    expect(result.slots[0]?.missingFactKeys).toEqual([]);
  });

  it('MB selected, case supports form factor → COMPATIBLE with positive reason', () => {
    const engine = createDefaultCompatibilityEngine();
    const result = engine.evaluate(
      facts({
        motherboard: { 'mb.formFactor': 'ATX' },
        case: { 'case.supportedFormFactors': ['ATX', 'Micro-ATX', 'Mini-ITX'] },
      }),
      ['motherboard'],
    );
    expect(result.slots[0]?.status).toBe('COMPATIBLE');
    expect(result.slots[0]?.triggeredRuleIds).toContain('CMP-MB-CASE-001');
    expect(result.slots[0]?.topReasons.join(' ')).toContain('supports');
    expect(result.slots[0]?.missingFactKeys).toEqual([]);
  });
});
