import { describe, it, expect } from 'vitest';
import { CompatibilityEngine, reduceBuildStatus, NO_ACTIVE_RULE_REASON } from '../engine.js';
import type { BuildSlot, CompatibilitySlotStatus } from '@buildsense/domain';
import type { CompatibilityRule, CandidateCompatibilityGroup } from '../types.js';
import { activateRule, RULE_DEFINITIONS } from '../rules.js';

const ALL_SLOTS: BuildSlot[] = [
  'cpu',
  'motherboard',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case',
];

// ---------------------------------------------------------------------------
// Existing zero-rule and registry tests (updated for topReasons)
// ---------------------------------------------------------------------------

describe('CompatibilityEngine', () => {
  describe('default evaluator (no rules registered)', () => {
    const engine = new CompatibilityEngine();
    const emptyFacts = new Map<BuildSlot, Record<string, unknown>>();

    it('returns UNKNOWN for every slot when no rules are registered', () => {
      const result = engine.evaluate(emptyFacts, ALL_SLOTS);

      expect(result.overallStatus).toBe('UNKNOWN');
      expect(result.slots).toHaveLength(ALL_SLOTS.length);
      for (const slotResult of result.slots) {
        expect(slotResult.status).toBe('UNKNOWN');
        expect(slotResult.triggeredRuleIds).toEqual([]);
        expect(slotResult.topReasons).toEqual([NO_ACTIVE_RULE_REASON]);
        expect(slotResult.missingFactKeys).toEqual([]);
      }
    });

    it('returns UNKNOWN for a single slot', () => {
      const result = engine.evaluate(emptyFacts, ['cpu']);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0]?.status).toBe('UNKNOWN');
      expect(result.slots[0]?.topReasons).toEqual([NO_ACTIVE_RULE_REASON]);
    });

    it('returns UNKNOWN when facts are present but no rules exist', () => {
      const facts = new Map<BuildSlot, Record<string, unknown>>([
        ['cpu', { socket: 'AM5', tdp: 170 }],
      ]);
      const result = engine.evaluate(facts, ['cpu']);
      expect(result.slots[0]?.status).toBe('UNKNOWN');
      expect(result.slots[0]?.topReasons).toEqual([NO_ACTIVE_RULE_REASON]);
    });

    it('returns UNKNOWN for all slots with partial facts and no rules', () => {
      const facts = new Map<BuildSlot, Record<string, unknown>>([
        ['cpu', { socket: 'AM5' }],
        ['motherboard', { socket: 'AM5' }],
      ]);
      const result = engine.evaluate(facts, ALL_SLOTS);
      expect(result.overallStatus).toBe('UNKNOWN');
      for (const slotResult of result.slots) {
        expect(slotResult.status).toBe('UNKNOWN');
        expect(slotResult.topReasons).toEqual([NO_ACTIVE_RULE_REASON]);
      }
    });
  });

  describe('classifyCandidate', () => {
    const engine = new CompatibilityEngine();

    it('returns UNKNOWN when no rules are registered', () => {
      const result = engine.classifyCandidate(
        'cpu',
        { socket: 'AM5' },
        new Map(),
      );
      expect(result).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for any slot with no rules', () => {
      for (const slot of ALL_SLOTS) {
        const result = engine.classifyCandidate(slot, {}, new Map());
        expect(result).toBe('UNKNOWN');
      }
    });
  });

  describe('rule registry', () => {
    it('starts with no rules', () => {
      const engine = new CompatibilityEngine();
      expect(engine.getAllRules()).toEqual([]);
    });

    it('registers and retrieves a rule', () => {
      const engine = new CompatibilityEngine();
      const rule: CompatibilityRule = {
        id: 'test-rule',
        description: 'Test rule',
        requiredSlots: ['cpu'],
        evaluate: () => 'COMPATIBLE',
      };

      engine.register(rule);
      expect(engine.getAllRules()).toHaveLength(1);
      expect(engine.getRulesForSlot('cpu')).toHaveLength(1);
      expect(engine.getRulesForSlot('gpu')).toHaveLength(0);
    });

    it('finds rules that apply to multiple slots', () => {
      const engine = new CompatibilityEngine();
      const rule: CompatibilityRule = {
        id: 'cpu-mb-rule',
        description: 'CPU-Motherboard rule',
        requiredSlots: ['cpu', 'motherboard'],
        evaluate: () => 'COMPATIBLE',
      };

      engine.register(rule);
      expect(engine.getRulesForSlot('cpu')).toHaveLength(1);
      expect(engine.getRulesForSlot('motherboard')).toHaveLength(1);
      expect(engine.getRulesForSlot('gpu')).toHaveLength(0);
    });
  });

  describe('evaluate with registered rules', () => {
    it('delegates to rules and reduces status correctly', () => {
      const engine = new CompatibilityEngine();
      const rule: CompatibilityRule = {
        id: 'always-compatible',
        description: 'Always compatible',
        requiredSlots: ['cpu'],
        evaluate: () => 'COMPATIBLE',
      };
      engine.register(rule);

      const result = engine.evaluate(new Map(), ['cpu']);
      expect(result.slots[0]?.status).toBe('COMPATIBLE');
      expect(result.slots[0]?.triggeredRuleIds).toEqual(['always-compatible']);
      expect(result.slots[0]?.topReasons).toEqual([]);
      expect(result.overallStatus).toBe('COMPATIBLE');
    });

    it('returns INCOMPATIBLE when a rule returns INCOMPATIBLE', () => {
      const engine = new CompatibilityEngine();
      const rule: CompatibilityRule = {
        id: 'always-incompatible',
        description: 'Always incompatible',
        requiredSlots: ['cpu'],
        evaluate: () => 'INCOMPATIBLE',
      };
      engine.register(rule);

      const result = engine.evaluate(new Map(), ['cpu']);
      expect(result.slots[0]?.status).toBe('INCOMPATIBLE');
      expect(result.overallStatus).toBe('INCOMPATIBLE');
    });
  });
});

// ---------------------------------------------------------------------------
// reduceBuildStatus tests
// ---------------------------------------------------------------------------

describe('reduceBuildStatus', () => {
  it('returns UNKNOWN for empty results', () => {
    expect(reduceBuildStatus([])).toBe('UNKNOWN');
  });

  it('returns COMPATIBLE when all slots are COMPATIBLE', () => {
    const results = ALL_SLOTS.map((slot) => ({
      slot,
      status: 'COMPATIBLE' as CompatibilitySlotStatus,
      triggeredRuleIds: [],
      topReasons: [],
      missingFactKeys: [],
    }));
    expect(reduceBuildStatus(results)).toBe('COMPATIBLE');
  });

  it('returns INCOMPATIBLE when any slot is INCOMPATIBLE', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'COMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
      { slot: 'gpu' as BuildSlot, status: 'INCOMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: ['r1'], topReasons: [], missingFactKeys: [] },
    ];
    expect(reduceBuildStatus(results)).toBe('INCOMPATIBLE');
  });

  it('returns WARNING when any slot is WARNING and none INCOMPATIBLE', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'COMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
      { slot: 'gpu' as BuildSlot, status: 'WARNING' as CompatibilitySlotStatus, triggeredRuleIds: ['r1'], topReasons: [], missingFactKeys: [] },
    ];
    expect(reduceBuildStatus(results)).toBe('WARNING');
  });

  it('returns UNKNOWN when some slots are UNKNOWN and none worse', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'COMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
      { slot: 'gpu' as BuildSlot, status: 'UNKNOWN' as CompatibilitySlotStatus, triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
    ];
    expect(reduceBuildStatus(results)).toBe('UNKNOWN');
  });

  it('returns INCOMPATIBLE when mix includes INCOMPATIBLE and UNKNOWN', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'UNKNOWN' as CompatibilitySlotStatus, triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
      { slot: 'gpu' as BuildSlot, status: 'INCOMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: ['r1'], topReasons: [], missingFactKeys: [] },
    ];
    expect(reduceBuildStatus(results)).toBe('INCOMPATIBLE');
  });

  it('returns INCOMPATIBLE when mix includes all four statuses', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'COMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
      { slot: 'motherboard' as BuildSlot, status: 'UNKNOWN' as CompatibilitySlotStatus, triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
      { slot: 'ram' as BuildSlot, status: 'WARNING' as CompatibilitySlotStatus, triggeredRuleIds: ['r1'], topReasons: [], missingFactKeys: [] },
      { slot: 'gpu' as BuildSlot, status: 'INCOMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: ['r2'], topReasons: [], missingFactKeys: [] },
    ];
    expect(reduceBuildStatus(results)).toBe('INCOMPATIBLE');
  });

  it('returns WARNING when mix includes WARNING and UNKNOWN but no INCOMPATIBLE', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'COMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
      { slot: 'motherboard' as BuildSlot, status: 'UNKNOWN' as CompatibilitySlotStatus, triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
      { slot: 'ram' as BuildSlot, status: 'WARNING' as CompatibilitySlotStatus, triggeredRuleIds: ['r1'], topReasons: [], missingFactKeys: [] },
    ];
    expect(reduceBuildStatus(results)).toBe('WARNING');
  });
});

// ---------------------------------------------------------------------------
// Phase 0A: CandidateCompatibilityGroup type widening and warning-group
// ---------------------------------------------------------------------------

describe('CandidateCompatibilityGroup type', () => {
  it('includes all four expected groups', () => {
    const groups: CandidateCompatibilityGroup[] = [
      'COMPATIBLE',
      'COMPATIBLE_WITH_WARNINGS',
      'INCOMPATIBLE',
      'UNKNOWN',
    ];
    expect(groups).toHaveLength(4);
    expect(groups).toContain('COMPATIBLE');
    expect(groups).toContain('COMPATIBLE_WITH_WARNINGS');
    expect(groups).toContain('INCOMPATIBLE');
    expect(groups).toContain('UNKNOWN');
  });

  it('classifyCandidate return type accepts COMPATIBLE_WITH_WARNINGS', () => {
    const engine = new CompatibilityEngine();
    // With no rules, always returns UNKNOWN — never fabricates warnings.
    const result: CandidateCompatibilityGroup = engine.classifyCandidate(
      'cpu',
      {},
      new Map(),
    );
    expect(result).toBe('UNKNOWN');
  });
});

// ---------------------------------------------------------------------------
// Phase 0A: No rule registration / no reference fabrication
// ---------------------------------------------------------------------------

describe('Phase 0A invariants', () => {
  it('engine starts with zero rules registered', () => {
    const engine = new CompatibilityEngine();
    expect(engine.getAllRules()).toHaveLength(0);
  });

  it('zero-rule evaluation always returns UNKNOWN — never COMPATIBLE', () => {
    const engine = new CompatibilityEngine();
    const facts = new Map<BuildSlot, Record<string, unknown>>([
      ['cpu', { socket: 'AM5', tdp: 170 }],
      ['motherboard', { socket: 'AM5', chipset: 'B650' }],
    ]);
    const result = engine.evaluate(facts, ALL_SLOTS);
    expect(result.overallStatus).toBe('UNKNOWN');
    for (const slot of result.slots) {
      expect(slot.status).toBe('UNKNOWN');
    }
  });

  it('zero-rule candidate classification always returns UNKNOWN', () => {
    const engine = new CompatibilityEngine();
    const result = engine.classifyCandidate(
      'cpu',
      { socket: 'AM5', family: 'Ryzen 7000' },
      new Map([['motherboard', { socket: 'AM5' }]]),
    );
    expect(result).toBe('UNKNOWN');
  });
});

// ---------------------------------------------------------------------------
// missingFactKeys tests
// ---------------------------------------------------------------------------

describe('missingFactKeys', () => {
  it('returns empty missingFactKeys when no rules are registered', () => {
    const engine = new CompatibilityEngine();
    const result = engine.evaluate(new Map(), ALL_SLOTS);
    for (const slot of result.slots) {
      expect(slot.missingFactKeys).toEqual([]);
    }
  });

  it('returns empty missingFactKeys for COMPATIBLE result', () => {
    const definition = RULE_DEFINITIONS.find((r) => r.id === 'CMP-CPU-MB-001')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));
    const facts = new Map<BuildSlot, Record<string, unknown>>([
      ['cpu', { 'cpu.socket': 'AM5' }],
      ['motherboard', { 'mb.socket': 'AM5' }],
    ]);
    const result = engine.evaluate(facts, ['cpu']);
    expect(result.slots[0]?.status).toBe('COMPATIBLE');
    expect(result.slots[0]?.missingFactKeys).toEqual([]);
  });

  it('returns empty missingFactKeys for INCOMPATIBLE result', () => {
    const definition = RULE_DEFINITIONS.find((r) => r.id === 'CMP-CPU-MB-001')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));
    const facts = new Map<BuildSlot, Record<string, unknown>>([
      ['cpu', { 'cpu.socket': 'AM4' }],
      ['motherboard', { 'mb.socket': 'AM5' }],
    ]);
    const result = engine.evaluate(facts, ['cpu']);
    expect(result.slots[0]?.status).toBe('INCOMPATIBLE');
    expect(result.slots[0]?.missingFactKeys).toEqual([]);
  });

  it('returns missingFactKeys for UNKNOWN caused by absent facts', () => {
    const definition = RULE_DEFINITIONS.find((r) => r.id === 'CMP-CPU-MB-001')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));
    const facts = new Map<BuildSlot, Record<string, unknown>>([
      ['cpu', { 'cpu.socket': 'AM5' }],
      // motherboard missing entirely → mb.socket absent
    ]);
    const result = engine.evaluate(facts, ['cpu']);
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.missingFactKeys).toEqual(['mb.socket']);
  });

  it('returns both missing keys when both sides are absent', () => {
    const definition = RULE_DEFINITIONS.find((r) => r.id === 'CMP-CPU-MB-001')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));
    const result = engine.evaluate(new Map(), ['cpu']);
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.missingFactKeys).toEqual(['cpu.socket', 'mb.socket']);
  });

  it('returns missingFactKeys from multi-slot rule aggregated to affected slot', () => {
    const definition = RULE_DEFINITIONS.find((r) => r.id === 'CMP-PSU-001')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));
    // Only PSU present, CPU and GPU facts absent
    const facts = new Map<BuildSlot, Record<string, unknown>>([
      ['psu', { 'psu.wattage': 750 }],
    ]);
    const result = engine.evaluate(facts, ['cpu', 'gpu', 'psu']);
    // All three slots are evaluated by CMP-PSU-001; cpu.tdpWatts and gpu.boardPowerWatts are missing
    const cpuSlot = result.slots.find((s) => s.slot === 'cpu');
    expect(cpuSlot?.status).toBe('UNKNOWN');
    expect(cpuSlot?.missingFactKeys).toEqual(['cpu.tdpWatts', 'gpu.boardPowerWatts']);
  });

  it('deduplicates missing keys from multiple rules', () => {
    // Register two rules that both need cpu.socket
    const socketRule = RULE_DEFINITIONS.find((r) => r.id === 'CMP-CPU-MB-001')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(socketRule, true));
    // Stub rule that always returns UNKNOWN with no missingFactKeys method
    const stubRule: CompatibilityRule = {
      id: 'CMP-CPU-MB-002',
      description: 'CPU family support (stub)',
      requiredSlots: ['cpu', 'motherboard'],
      evaluate: () => 'UNKNOWN',
    };
    engine.register(stubRule);
    const facts = new Map<BuildSlot, Record<string, unknown>>([
      ['cpu', {}],
    ]);
    const result = engine.evaluate(facts, ['cpu']);
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    // Only socketRule contributes missing keys (cpu.socket and mb.socket); stub contributes []
    expect(result.slots[0]?.missingFactKeys).toEqual(['cpu.socket', 'mb.socket']);
  });

  it('sorts missing keys deterministically', () => {
    const definition = RULE_DEFINITIONS.find((r) => r.id === 'CMP-PSU-001')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));
    const result = engine.evaluate(new Map(), ['cpu']);
    expect(result.slots[0]?.missingFactKeys).toEqual(['cpu.tdpWatts', 'gpu.boardPowerWatts', 'psu.wattage']);
  });

  it('returns empty missingFactKeys when stub rule is the only rule and facts are present', () => {
    // CMP-CPU-MB-002 is a stub that always returns UNKNOWN
    const stubRule = RULE_DEFINITIONS.find((r) => r.id === 'CMP-CPU-MB-002')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(stubRule, true));
    const facts = new Map<BuildSlot, Record<string, unknown>>([
      ['cpu', { 'cpu.family': 'Ryzen 7000' }],
      ['motherboard', { 'mb.chipset': 'B650' }],
    ]);
    const result = engine.evaluate(facts, ['cpu']);
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    // Stub rule has no missingFactKeys method → defaults to []
    expect(result.slots[0]?.missingFactKeys).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// No-active-rule UNKNOWN semantics
// ---------------------------------------------------------------------------

describe('no-active-rule UNKNOWN semantics', () => {
  it('UNKNOWN with no active rules returns the honest reason and empty missingFactKeys', () => {
    const engine = new CompatibilityEngine();
    const result = engine.evaluate(new Map(), ['cpu', 'gpu', 'psu']);
    for (const slot of result.slots) {
      expect(slot.status).toBe('UNKNOWN');
      expect(slot.triggeredRuleIds).toEqual([]);
      expect(slot.topReasons).toEqual([NO_ACTIVE_RULE_REASON]);
      expect(slot.missingFactKeys).toEqual([]);
    }
  });

  it('UNKNOWN with no active rules but facts present still returns the honest reason', () => {
    const engine = new CompatibilityEngine();
    const facts = new Map<BuildSlot, Record<string, unknown>>([
      ['cpu', { 'cpu.socket': 'AM5' }],
    ]);
    const result = engine.evaluate(facts, ['cpu']);
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.topReasons).toEqual([NO_ACTIVE_RULE_REASON]);
    expect(result.slots[0]?.missingFactKeys).toEqual([]);
  });

  it('existing missing-fact UNKNOWN retains missing keys and does not get no-active-rule reason', () => {
    const definition = RULE_DEFINITIONS.find((r) => r.id === 'CMP-CPU-MB-001')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));
    const facts = new Map<BuildSlot, Record<string, unknown>>([
      ['cpu', { 'cpu.socket': 'AM5' }],
    ]);
    const result = engine.evaluate(facts, ['cpu']);
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.missingFactKeys).toEqual(['mb.socket']);
    // Rule produced this UNKNOWN — must NOT get the no-active-rule reason
    expect(result.slots[0]?.topReasons).not.toContain(NO_ACTIVE_RULE_REASON);
    // equalityRule returns null reason when facts are absent — topReasons may be empty
    expect(result.slots[0]?.triggeredRuleIds).toEqual([]);
  });

  it('unsupported stub rule UNKNOWN preserves its own reason and empty missing keys', () => {
    const stubRule: CompatibilityRule = {
      id: 'stub-ref-rule',
      description: 'Reference data rule (stub)',
      requiredSlots: ['cpu', 'motherboard'],
      evaluate: () => 'UNKNOWN',
      reason: () => 'Reference data for family compatibility is not yet available.',
    };
    const engine = new CompatibilityEngine();
    engine.register(stubRule);
    const facts = new Map<BuildSlot, Record<string, unknown>>([
      ['cpu', { 'cpu.family': 'Ryzen 7000' }],
      ['motherboard', { 'mb.chipset': 'B650' }],
    ]);
    const result = engine.evaluate(facts, ['cpu']);
    expect(result.slots[0]?.status).toBe('UNKNOWN');
    expect(result.slots[0]?.topReasons).toEqual(['Reference data for family compatibility is not yet available.']);
    expect(result.slots[0]?.missingFactKeys).toEqual([]);
  });

  it('ACTIVE-rule COMPATIBLE/FAIL/WARNING are unchanged', () => {
    const definition = RULE_DEFINITIONS.find((r) => r.id === 'CMP-CPU-MB-001')!;
    const engine = new CompatibilityEngine();
    engine.register(activateRule(definition, true));

    const compatible = engine.evaluate(
      new Map([['cpu', { 'cpu.socket': 'AM5' }], ['motherboard', { 'mb.socket': 'AM5' }]]),
      ['cpu'],
    );
    expect(compatible.slots[0]?.status).toBe('COMPATIBLE');
    expect(compatible.slots[0]?.missingFactKeys).toEqual([]);

    const incompatible = engine.evaluate(
      new Map([['cpu', { 'cpu.socket': 'AM4' }], ['motherboard', { 'mb.socket': 'AM5' }]]),
      ['cpu'],
    );
    expect(incompatible.slots[0]?.status).toBe('INCOMPATIBLE');
    expect(incompatible.slots[0]?.missingFactKeys).toEqual([]);
  });
});
