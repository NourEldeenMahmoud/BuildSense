import type {
  BuildSlot,
  CompatibilitySlotStatus,
  BuildCompatibilityStatus,
  CategoryQualityReport,
  ReferenceDataset,
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
  readonly requiredFactKeys?: readonly string[];
  /** Inactive rules stay registered for traceability but are not evaluated. */
  readonly active?: boolean;
  evaluate(context: RuleEvaluationContext): CompatibilitySlotStatus;
  reason?(context: RuleEvaluationContext, status: CompatibilitySlotStatus): string | null;
  /**
   * Returns the canonical fact keys that are absent from the build facts and
   * caused an UNKNOWN result. Stub/unsupported rules that always return
   * UNKNOWN regardless of facts should not implement this method (defaults to []).
   * Only call this when evaluate() returned UNKNOWN.
   */
  missingFactKeys?(context: RuleEvaluationContext): readonly string[];
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
  /**
   * Canonical fact keys that are absent and caused an UNKNOWN status.
   * Empty for COMPATIBLE, INCOMPATIBLE, WARNING, or UNKNOWN caused by
   * unsupported/inactive rules rather than missing data.
   */
  readonly missingFactKeys: readonly string[];
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

export interface CandidateClassificationResult {
  readonly group: CandidateCompatibilityGroup;
  readonly topReasons: readonly string[];
  readonly triggeredRuleIds: readonly string[];
}

export interface RuleActivationContext {
  readonly qualityReports: readonly CategoryQualityReport[];
  readonly referenceDataset?: ReferenceDataset | null;
}

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
  classifyCandidateWithReasons(
    slot: BuildSlot,
    candidateFacts: Record<string, unknown>,
    buildFacts: ReadonlyMap<BuildSlot, Record<string, unknown>>,
  ): CandidateClassificationResult;
}
