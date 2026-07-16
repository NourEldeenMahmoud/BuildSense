export { CompatibilityEngine, reduceBuildStatus } from './engine.js';
export { createDefaultCompatibilityEngine } from './registry.js';
export { passesFactQualityGate, hasAuthoritativeCpuSupportData } from './gates.js';
export { RULE_DEFINITIONS } from './rules.js';
export type {
  CompatibilityRule,
  RuleEvaluationContext,
  RuleRegistry,
  CompatibilityEvaluator,
  CandidateClassifier,
  SlotEvaluationResult,
  BuildEvaluationResult,
  CandidateCompatibilityGroup,
  CandidateClassificationResult,
  RuleActivationContext,
} from './types.js';
