import { describe, it, expect } from 'vitest';
import { CompatibilityEngine, reduceBuildStatus } from '../engine.js';
import type { BuildSlot, CompatibilitySlotStatus } from '@buildsense/domain';
import type { CompatibilityRule } from '../types.js';

const ALL_SLOTS: BuildSlot[] = [
  'cpu',
  'motherboard',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case',
];

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
      }
    });

    it('returns UNKNOWN for a single slot', () => {
      const result = engine.evaluate(emptyFacts, ['cpu']);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0]?.status).toBe('UNKNOWN');
    });

    it('returns UNKNOWN when facts are present but no rules exist', () => {
      const facts = new Map<BuildSlot, Record<string, unknown>>([
        ['cpu', { socket: 'AM5', tdp: 170 }],
      ]);
      const result = engine.evaluate(facts, ['cpu']);
      expect(result.slots[0]?.status).toBe('UNKNOWN');
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

describe('reduceBuildStatus', () => {
  it('returns UNKNOWN for empty results', () => {
    expect(reduceBuildStatus([])).toBe('UNKNOWN');
  });

  it('returns COMPATIBLE when all slots are COMPATIBLE', () => {
    const results = ALL_SLOTS.map((slot) => ({
      slot,
      status: 'COMPATIBLE' as CompatibilitySlotStatus,
      triggeredRuleIds: [],
    }));
    expect(reduceBuildStatus(results)).toBe('COMPATIBLE');
  });

  it('returns INCOMPATIBLE when any slot is INCOMPATIBLE', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'COMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: [] },
      { slot: 'gpu' as BuildSlot, status: 'INCOMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: ['r1'] },
    ];
    expect(reduceBuildStatus(results)).toBe('INCOMPATIBLE');
  });

  it('returns WARNING when any slot is WARNING and none INCOMPATIBLE', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'COMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: [] },
      { slot: 'gpu' as BuildSlot, status: 'WARNING' as CompatibilitySlotStatus, triggeredRuleIds: ['r1'] },
    ];
    expect(reduceBuildStatus(results)).toBe('WARNING');
  });

  it('returns UNKNOWN when some slots are UNKNOWN and none worse', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'COMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: [] },
      { slot: 'gpu' as BuildSlot, status: 'UNKNOWN' as CompatibilitySlotStatus, triggeredRuleIds: [] },
    ];
    expect(reduceBuildStatus(results)).toBe('UNKNOWN');
  });

  it('returns INCOMPATIBLE when mix includes INCOMPATIBLE and UNKNOWN', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'UNKNOWN' as CompatibilitySlotStatus, triggeredRuleIds: [] },
      { slot: 'gpu' as BuildSlot, status: 'INCOMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: ['r1'] },
    ];
    expect(reduceBuildStatus(results)).toBe('INCOMPATIBLE');
  });

  it('returns INCOMPATIBLE when mix includes all four statuses', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'COMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: [] },
      { slot: 'motherboard' as BuildSlot, status: 'UNKNOWN' as CompatibilitySlotStatus, triggeredRuleIds: [] },
      { slot: 'ram' as BuildSlot, status: 'WARNING' as CompatibilitySlotStatus, triggeredRuleIds: ['r1'] },
      { slot: 'gpu' as BuildSlot, status: 'INCOMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: ['r2'] },
    ];
    expect(reduceBuildStatus(results)).toBe('INCOMPATIBLE');
  });

  it('returns WARNING when mix includes WARNING and UNKNOWN but no INCOMPATIBLE', () => {
    const results = [
      { slot: 'cpu' as BuildSlot, status: 'COMPATIBLE' as CompatibilitySlotStatus, triggeredRuleIds: [] },
      { slot: 'motherboard' as BuildSlot, status: 'UNKNOWN' as CompatibilitySlotStatus, triggeredRuleIds: [] },
      { slot: 'ram' as BuildSlot, status: 'WARNING' as CompatibilitySlotStatus, triggeredRuleIds: ['r1'] },
    ];
    expect(reduceBuildStatus(results)).toBe('WARNING');
  });
});
