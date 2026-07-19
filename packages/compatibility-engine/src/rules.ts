import type { BuildSlot } from '@buildsense/domain';
import type { CompatibilityRule, RuleEvaluationContext } from './types.js';

export type RuleDefinition = Omit<CompatibilityRule, 'active' | 'requiredFactKeys' | 'reason'> & {
  readonly requiredFactKeys: readonly string[];
  reason(context: RuleEvaluationContext, status: ReturnType<CompatibilityRule['evaluate']>): string | null;
};

function value(context: RuleEvaluationContext, slot: BuildSlot, key: string): unknown {
  return context.buildFacts.get(slot)?.[key];
}

function text(context: RuleEvaluationContext, slot: BuildSlot, key: string): string | null {
  const result = value(context, slot, key);
  return typeof result === 'string' && result.length > 0 ? result : null;
}

function numberValue(context: RuleEvaluationContext, slot: BuildSlot, key: string): number | null {
  const result = value(context, slot, key);
  return typeof result === 'number' && Number.isFinite(result) ? result : null;
}

function booleanValue(context: RuleEvaluationContext, slot: BuildSlot, key: string): boolean | null {
  const result = value(context, slot, key);
  return typeof result === 'boolean' ? result : null;
}

function strings(context: RuleEvaluationContext, slot: BuildSlot, key: string): readonly string[] | null {
  const result = value(context, slot, key);
  return Array.isArray(result) && result.every((item) => typeof item === 'string')
    ? result as string[]
    : null;
}

function equalityRule(
  id: string,
  description: string,
  left: readonly [BuildSlot, string],
  right: readonly [BuildSlot, string],
): RuleDefinition {
  return {
    id,
    description,
    requiredSlots: [left[0], right[0]],
    requiredFactKeys: [left[1], right[1]],
    evaluate(context) {
      const leftValue = text(context, left[0], left[1]);
      const rightValue = text(context, right[0], right[1]);
      if (!leftValue || !rightValue) return 'UNKNOWN';
      return leftValue.toLowerCase() === rightValue.toLowerCase() ? 'COMPATIBLE' : 'INCOMPATIBLE';
    },
    reason(context, status) {
      const leftValue = text(context, left[0], left[1]);
      const rightValue = text(context, right[0], right[1]);
      if (!leftValue || !rightValue) return null;
      return status === 'COMPATIBLE'
        ? `${description}: ${leftValue} matches ${rightValue}`
        : `${description}: ${leftValue} does not match ${rightValue}`;
    },
    missingFactKeys(context) {
      const leftValue = text(context, left[0], left[1]);
      const rightValue = text(context, right[0], right[1]);
      const missing: string[] = [];
      if (!leftValue) missing.push(left[1]);
      if (!rightValue) missing.push(right[1]);
      return missing;
    },
  };
}

function maximumRule(
  id: string,
  description: string,
  actual: readonly [BuildSlot, string],
  maximum: readonly [BuildSlot, string],
  warningWhenExceeded = false,
): RuleDefinition {
  return {
    id,
    description,
    requiredSlots: [actual[0], maximum[0]],
    requiredFactKeys: [actual[1], maximum[1]],
    evaluate(context) {
      const actualValue = numberValue(context, actual[0], actual[1]);
      const maximumValue = numberValue(context, maximum[0], maximum[1]);
      if (actualValue === null || maximumValue === null) return 'UNKNOWN';
      if (actualValue <= maximumValue) return 'COMPATIBLE';
      return warningWhenExceeded ? 'WARNING' : 'INCOMPATIBLE';
    },
    reason(context, status) {
      const actualValue = numberValue(context, actual[0], actual[1]);
      const maximumValue = numberValue(context, maximum[0], maximum[1]);
      if (actualValue === null || maximumValue === null) return null;
      return `${description}: required ${actualValue}, supported ${maximumValue} (${status.toLowerCase()})`;
    },
    missingFactKeys(context) {
      const actualValue = numberValue(context, actual[0], actual[1]);
      const maximumValue = numberValue(context, maximum[0], maximum[1]);
      const missing: string[] = [];
      if (actualValue === null) missing.push(actual[1]);
      if (maximumValue === null) missing.push(maximum[1]);
      return missing;
    },
  };
}

export const RULE_DEFINITIONS: readonly RuleDefinition[] = [
  equalityRule('CMP-CPU-MB-001', 'CPU and motherboard socket', ['cpu', 'cpu.socket'], ['motherboard', 'mb.socket']),
  {
    id: 'CMP-CPU-MB-002',
    description: 'CPU family support and BIOS readiness',
    requiredSlots: ['cpu', 'motherboard'],
    requiredFactKeys: ['cpu.family', 'mb.chipset'],
    evaluate: () => 'UNKNOWN',
    reason: () => null,
  },
  equalityRule('CMP-MB-RAM-001', 'Motherboard and RAM generation', ['ram', 'ram.generation'], ['motherboard', 'mb.ramGeneration']),
  equalityRule('CMP-MB-RAM-002', 'Motherboard and RAM module type', ['ram', 'ram.moduleType'], ['motherboard', 'mb.ramType']),
  maximumRule('CMP-MB-RAM-003', 'RAM module count', ['ram', 'ram.moduleCount'], ['motherboard', 'mb.dimmSlots']),
  maximumRule('CMP-MB-RAM-004', 'RAM capacity', ['ram', 'ram.capacityGB'], ['motherboard', 'mb.maxMemoryGB']),
  maximumRule('CMP-MB-RAM-005', 'RAM speed', ['ram', 'ram.speedMHz'], ['motherboard', 'mb.maxMemorySpeedMHz'], true),
  {
    id: 'CMP-MB-CASE-001',
    description: 'Motherboard form factor supported by case',
    requiredSlots: ['motherboard', 'case'],
    requiredFactKeys: ['mb.formFactor', 'case.supportedFormFactors'],
    evaluate(context) {
      const formFactor = text(context, 'motherboard', 'mb.formFactor');
      const supported = strings(context, 'case', 'case.supportedFormFactors');
      if (!formFactor || !supported) return 'UNKNOWN';
      return supported.some((item) => item.toLowerCase() === formFactor.toLowerCase()) ? 'COMPATIBLE' : 'INCOMPATIBLE';
    },
    reason(context, status) {
      if (status === 'UNKNOWN') return null;
      const formFactor = text(context, 'motherboard', 'mb.formFactor');
      if (!formFactor) return null;
      return `Case ${status === 'COMPATIBLE' ? 'supports' : 'does not support'} ${formFactor}`;
    },
    missingFactKeys(context) {
      const formFactor = text(context, 'motherboard', 'mb.formFactor');
      const supported = strings(context, 'case', 'case.supportedFormFactors');
      const missing: string[] = [];
      if (!formFactor) missing.push('mb.formFactor');
      if (!supported) missing.push('case.supportedFormFactors');
      return missing;
    },
  },
  maximumRule('CMP-GPU-CASE-001', 'GPU length clearance', ['gpu', 'gpu.lengthMM'], ['case', 'case.maxGpuLengthMM']),
  maximumRule('CMP-GPU-CASE-002', 'GPU expansion slot width', ['gpu', 'gpu.slotWidth'], ['case', 'case.expansionSlots']),
  {
    id: 'CMP-PSU-001',
    description: 'PSU wattage headroom',
    requiredSlots: ['cpu', 'gpu', 'psu'],
    requiredFactKeys: ['cpu.tdpWatts', 'gpu.boardPowerWatts', 'psu.wattage'],
    evaluate(context) {
      const cpu = numberValue(context, 'cpu', 'cpu.tdpWatts');
      const gpu = numberValue(context, 'gpu', 'gpu.boardPowerWatts');
      const psu = numberValue(context, 'psu', 'psu.wattage');
      if (cpu === null || gpu === null || psu === null) return 'UNKNOWN';
      const estimate = cpu + gpu + 100;
      if (psu < estimate) return 'INCOMPATIBLE';
      return psu >= estimate * 1.2 ? 'COMPATIBLE' : 'WARNING';
    },
    reason(context, status) {
      const cpu = numberValue(context, 'cpu', 'cpu.tdpWatts');
      const gpu = numberValue(context, 'gpu', 'gpu.boardPowerWatts');
      const psu = numberValue(context, 'psu', 'psu.wattage');
      if (cpu === null || gpu === null || psu === null) return null;
      return `PSU ${psu}W vs estimated ${cpu + gpu + 100}W load (${status.toLowerCase()})`;
    },
    missingFactKeys(context) {
      const cpu = numberValue(context, 'cpu', 'cpu.tdpWatts');
      const gpu = numberValue(context, 'gpu', 'gpu.boardPowerWatts');
      const psu = numberValue(context, 'psu', 'psu.wattage');
      const missing: string[] = [];
      if (cpu === null) missing.push('cpu.tdpWatts');
      if (gpu === null) missing.push('gpu.boardPowerWatts');
      if (psu === null) missing.push('psu.wattage');
      return missing;
    },
  },
  {
    id: 'CMP-PSU-GPU-001',
    description: 'PSU provides required GPU power connectors',
    requiredSlots: ['gpu', 'psu'],
    requiredFactKeys: ['gpu.connectorTypes', 'gpu.connectorCount', 'psu.connectorTypes', 'psu.connectorCount'],
    evaluate: () => 'UNKNOWN',
    reason: () => null,
  },
  {
    id: 'CMP-STORAGE-MB-001',
    description: 'Motherboard supports storage interface',
    requiredSlots: ['storage', 'motherboard'],
    requiredFactKeys: ['storage.interface', 'mb.sataPorts', 'mb.m2Slots'],
    evaluate(context) {
      const storageInterface = text(context, 'storage', 'storage.interface');
      const sataPorts = numberValue(context, 'motherboard', 'mb.sataPorts');
      const m2Slots = numberValue(context, 'motherboard', 'mb.m2Slots');
      if (!storageInterface) return 'UNKNOWN';
      if (storageInterface.toLowerCase() === 'sata') {
        return sataPorts === null ? 'UNKNOWN' : sataPorts > 0 ? 'COMPATIBLE' : 'INCOMPATIBLE';
      }
      if (['nvme', 'pcie'].includes(storageInterface.toLowerCase())) {
        return m2Slots === null ? 'UNKNOWN' : m2Slots > 0 ? 'COMPATIBLE' : 'INCOMPATIBLE';
      }
      return 'UNKNOWN';
    },
    reason(context, status) {
      const storageInterface = text(context, 'storage', 'storage.interface');
      return storageInterface ? `${storageInterface} storage is ${status.toLowerCase()}` : null;
    },
    missingFactKeys(context) {
      const storageInterface = text(context, 'storage', 'storage.interface');
      if (!storageInterface) return ['storage.interface'];
      if (storageInterface.toLowerCase() === 'sata') {
        return numberValue(context, 'motherboard', 'mb.sataPorts') === null ? ['mb.sataPorts'] : [];
      }
      if (['nvme', 'pcie'].includes(storageInterface.toLowerCase())) {
        return numberValue(context, 'motherboard', 'mb.m2Slots') === null ? ['mb.m2Slots'] : [];
      }
      return [];
    },
  },
  {
    id: 'CMP-GRAPHICS-001',
    description: 'Build has display capability',
    requiredSlots: ['cpu', 'gpu'],
    requiredFactKeys: ['cpu.iGpu'],
    evaluate(context) {
      if (context.buildFacts.has('gpu')) return 'COMPATIBLE';
      const integrated = booleanValue(context, 'cpu', 'cpu.iGpu');
      if (integrated === null) return 'UNKNOWN';
      return integrated ? 'COMPATIBLE' : 'INCOMPATIBLE';
    },
    reason(context, status) {
      if (context.buildFacts.has('gpu')) return 'Dedicated GPU provides display output';
      const integrated = booleanValue(context, 'cpu', 'cpu.iGpu');
      if (integrated === null) return null;
      return status === 'COMPATIBLE' ? 'CPU includes integrated graphics' : 'No dedicated or integrated graphics available';
    },
    missingFactKeys(context) {
      if (context.buildFacts.has('gpu')) return [];
      const integrated = booleanValue(context, 'cpu', 'cpu.iGpu');
      return integrated === null ? ['cpu.iGpu'] : [];
    },
  },
];

export function activateRule(definition: RuleDefinition, active: boolean): CompatibilityRule {
  return { ...definition, active };
}
