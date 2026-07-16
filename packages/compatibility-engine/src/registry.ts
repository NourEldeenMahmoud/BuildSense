import type { CategoryQualityReport, ReferenceDataset } from '@buildsense/domain';
import { CompatibilityEngine } from './engine.js';
import { hasAuthoritativeCpuSupportData, passesFactQualityGate } from './gates.js';
import { activateRule, RULE_DEFINITIONS } from './rules.js';

const FACT_CATEGORY: Record<string, string> = {
  cpu: 'CPU',
  mb: 'Motherboard',
  ram: 'RAM',
  gpu: 'GPU',
  storage: 'Storage',
  psu: 'PSU',
  case: 'Case',
};

function factsPass(reports: readonly CategoryQualityReport[], factKeys: readonly string[]): boolean {
  return factKeys.every((factKey) => {
    const prefix = factKey.split('.')[0] ?? '';
    const category = FACT_CATEGORY[prefix];
    return category ? passesFactQualityGate(reports, category, factKey) : false;
  });
}

export function createDefaultCompatibilityEngine(options: {
  readonly qualityReports?: readonly CategoryQualityReport[];
  readonly referenceDataset?: ReferenceDataset | null;
} = {}): CompatibilityEngine {
  const reports = options.qualityReports ?? [];
  const engine = new CompatibilityEngine();

  for (const definition of RULE_DEFINITIONS) {
    let active = factsPass(reports, definition.requiredFactKeys);
    if (definition.id === 'CMP-CPU-MB-002') {
      active = active && hasAuthoritativeCpuSupportData(options.referenceDataset);
    }
    if (definition.id === 'CMP-PSU-GPU-001') {
      active = false;
    }
    engine.register(activateRule(definition, active));
  }

  return engine;
}
