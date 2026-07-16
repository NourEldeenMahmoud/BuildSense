import type {
  BuildSlot,
  CompatibilitySlotStatus,
  BuildCompatibilityStatus,
} from '@buildsense/domain';

// ---------------------------------------------------------------------------
// Rule interface (types only — no rule implementations in Phase 0)
// ---------------------------------------------------------------------------

/** Context provided to a compatibility rule during evaluation. */
export interface RuleEvaluationContext {
  readonly slot: BuildSlot;
  readonly slotFacts: Record<string, unknown>;
  readonly buildFacts: ReadonlyMap<BuildSlot, Record<string, unknown>>;
}

/**
 * A compatibility rule evaluates one or more slot pairs.
 * Phase 0 scaffold contains zero registered rules.
 */
export interface CompatibilityRule {
  readonly id: string;
  readonly description: string;
  readonly requiredSlots: readonly BuildSlot[];
  evaluate(context: RuleEvaluationContext): CompatibilitySlotStatus;
}

// ---------------------------------------------------------------------------
// Evaluation result types
// ---------------------------------------------------------------------------

/** Result of evaluating compatibility for a single slot. */
export interface SlotEvaluationResult {
  readonly slot: BuildSlot;
  readonly status: CompatibilitySlotStatus;
  readonly triggeredRuleIds: readonly string[];
  /** Top human-readable reasons for the slot status (for UI display). */
  readonly topReasons: readonly string[];
}

/** Result of evaluating compatibility for the entire build. */
export interface BuildEvaluationResult {
  readonly overallStatus: BuildCompatibilityStatus;
  readonly slots: readonly SlotEvaluationResult[];
}

/** How a candidate product is classified against the current build. */
export type CandidateCompatibilityGroup =
  | 'COMPATIBLE'
  | 'COMPATIBLE_WITH_WARNINGS'
  | 'INCOMPATIBLE'
  | 'UNKNOWN';

// ---------------------------------------------------------------------------
// Registry and evaluator interfaces (types only)
// ---------------------------------------------------------------------------

/** Registry for compatibility rules. */
export interface RuleRegistry {
  register(rule: CompatibilityRule): void;
  getRulesForSlot(slot: BuildSlot): readonly CompatibilityRule[];
  getAllRules(): readonly CompatibilityRule[];
}

/** Evaluates compatibility for a build. */
export interface CompatibilityEvaluator {
  evaluate(
    buildFacts: ReadonlyMap<BuildSlot, Record<string, unknown>>,
    slots: readonly BuildSlot[],
  ): BuildEvaluationResult;
}

/** Classifies a candidate product against the current build. */
export interface CandidateClassifier {
  classifyCandidate(
    slot: BuildSlot,
    candidateFacts: Record<string, unknown>,
    buildFacts: ReadonlyMap<BuildSlot, Record<string, unknown>>,
  ): CandidateCompatibilityGroup;
}
