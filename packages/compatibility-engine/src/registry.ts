import type { CategoryQualityReport, ReferenceDataset } from '@buildsense/domain';
import { CompatibilityEngine } from './engine.js';
import { hasAuthoritativeCpuSupportData } from './gates.js';
import { activateRule, RULE_DEFINITIONS } from './rules.js';

/**
 * IDs of rules that require external reference data beyond product facts
 * to produce a meaningful result. These remain inactive until the data is
 * available. All other implemented rules activate unconditionally —
 * quality reports are informational and do not gate runtime evaluation.
 */
const REFERENCE_DATA_RULE_IDS = new Set(['CMP-CPU-MB-002']);

/** Stub rules that always return UNKNOWN regardless of facts. */
const STUB_RULE_IDS = new Set(['CMP-PSU-GPU-001']);

export function createDefaultCompatibilityEngine(options: {
  readonly qualityReports?: readonly CategoryQualityReport[];
  readonly referenceDataset?: ReferenceDataset | null;
} = {}): CompatibilityEngine {
  const engine = new CompatibilityEngine();

  for (const definition of RULE_DEFINITIONS) {
    let active: boolean;

    if (STUB_RULE_IDS.has(definition.id)) {
      // Stub rules — always inactive.
      active = false;
    } else if (REFERENCE_DATA_RULE_IDS.has(definition.id)) {
      // Reference-data rules — active only when authoritative data exists.
      active = hasAuthoritativeCpuSupportData(options.referenceDataset);
    } else {
      // Implemented rules — always active. Rules evaluate UNKNOWN when
      // required facts are absent; quality reports do not gate activation.
      active = true;
    }

    engine.register(activateRule(definition, active));
  }

  return engine;
}
