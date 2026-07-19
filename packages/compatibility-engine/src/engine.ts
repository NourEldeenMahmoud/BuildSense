import type {
  BuildSlot,
  CompatibilitySlotStatus,
  BuildCompatibilityStatus,
} from '@buildsense/domain';
import type {
  CompatibilityRule,
  RuleEvaluationContext,
  RuleRegistry,
  CompatibilityEvaluator,
  CandidateClassifier,
  SlotEvaluationResult,
  BuildEvaluationResult,
  CandidateCompatibilityGroup,
  CandidateClassificationResult,
} from './types.js';

const UNKNOWN_STATUS: CompatibilitySlotStatus = 'UNKNOWN';

/**
 * Honest reason returned when no compatibility rule is registered or active
 * for a given slot. The engine cannot speculate about quality/reference gate
 * failures — it only knows that zero rules could evaluate this slot.
 */
export const NO_ACTIVE_RULE_REASON = 'No active compatibility rule can evaluate this slot.';

/**
 * Reduces per-slot evaluation results to an overall build compatibility status.
 *
 * Priority: INCOMPATIBLE > WARNING > UNKNOWN > COMPATIBLE.
 * UNKNOWN propagates: if any slot is UNKNOWN and none are worse, the build is UNKNOWN.
 */
export function reduceBuildStatus(
  slotResults: readonly SlotEvaluationResult[],
): BuildCompatibilityStatus {
  if (slotResults.length === 0) return UNKNOWN_STATUS;

  if (slotResults.some((r) => r.status === 'INCOMPATIBLE')) return 'INCOMPATIBLE';
  if (slotResults.some((r) => r.status === 'WARNING')) return 'WARNING';
  if (slotResults.every((r) => r.status === 'COMPATIBLE')) return 'COMPATIBLE';
  return UNKNOWN_STATUS;
}

/**
 * Minimal pure compatibility engine.
 *
 * Phase 0 scaffold: no rules registered, default evaluator deterministically
 * returns UNKNOWN for every slot — never PASS. The engine implements the
 * rule registry so future phases can register rules via the same instance.
 */
export class CompatibilityEngine
  implements RuleRegistry, CompatibilityEvaluator, CandidateClassifier
{
  private readonly rules: CompatibilityRule[] = [];

  // -- RuleRegistry --------------------------------------------------------

  register(rule: CompatibilityRule): void {
    this.rules.push(rule);
  }

  getRulesForSlot(slot: BuildSlot): readonly CompatibilityRule[] {
    return this.rules.filter((r) => r.active !== false && r.requiredSlots.includes(slot));
  }

  getAllRules(): readonly CompatibilityRule[] {
    return [...this.rules];
  }

  // -- CompatibilityEvaluator ----------------------------------------------

  /**
   * Evaluate compatibility for the given slots.
   * With no registered rules every slot returns UNKNOWN — never PASS.
   */
  evaluate(
    buildFacts: ReadonlyMap<BuildSlot, Record<string, unknown>>,
    slots: readonly BuildSlot[],
  ): BuildEvaluationResult {
    const slotResults: SlotEvaluationResult[] = slots.map((slot) => {
      const applicableRules = this.getRulesForSlot(slot);

      if (applicableRules.length === 0) {
        return { slot, status: UNKNOWN_STATUS, triggeredRuleIds: [], topReasons: [NO_ACTIVE_RULE_REASON], missingFactKeys: [] };
      }

      const slotFacts = buildFacts.get(slot) ?? {};
      const context: RuleEvaluationContext = { slot, slotFacts, buildFacts };

      const ruleResults = applicableRules.map((rule) => {
        const status = rule.evaluate(context);
        return {
          id: rule.id,
          status,
          reason: rule.reason?.(context, status) ?? null,
          missingFactKeys: status === UNKNOWN_STATUS
            ? (rule.missingFactKeys?.(context) ?? [])
            : [],
        };
      });

      const activeResults = ruleResults.filter(
        (r) => r.status !== UNKNOWN_STATUS,
      );

      if (activeResults.length === 0) {
        // All active rules returned UNKNOWN — aggregate missing keys and reasons.
        const unknownResults = ruleResults.filter(
          (r) => r.status === UNKNOWN_STATUS,
        );
        const missingKeys = [...new Set(unknownResults.flatMap((r) => r.missingFactKeys))].sort();
        const topReasons = unknownResults
          .flatMap((r) => (r.reason ? [r.reason] : []))
          .slice(0, 3);
        return { slot, status: UNKNOWN_STATUS, triggeredRuleIds: [], topReasons, missingFactKeys: missingKeys };
      }

      let status: CompatibilitySlotStatus = 'COMPATIBLE';
      if (activeResults.some((r) => r.status === 'INCOMPATIBLE')) {
        status = 'INCOMPATIBLE';
      } else if (activeResults.some((r) => r.status === 'WARNING')) {
        status = 'WARNING';
      }

      return {
        slot,
        status,
        triggeredRuleIds: activeResults.map((r) => r.id),
        topReasons: activeResults.flatMap((result) => result.reason ? [result.reason] : []).slice(0, 3),
        missingFactKeys: [],
      };
    });

    return {
      overallStatus: reduceBuildStatus(slotResults),
      slots: slotResults,
    };
  }

  // -- CandidateClassifier -------------------------------------------------

  /**
   * Classify a candidate product for a slot against the current build.
   * With no rules, always returns UNKNOWN.
   */
  classifyCandidate(
    slot: BuildSlot,
    _candidateFacts: Record<string, unknown>,
    _buildFacts: ReadonlyMap<BuildSlot, Record<string, unknown>>,
  ): CandidateCompatibilityGroup {
    return this.classifyCandidateWithReasons(slot, _candidateFacts, _buildFacts).group;
  }

  classifyCandidateWithReasons(
    slot: BuildSlot,
    candidateFacts: Record<string, unknown>,
    buildFacts: ReadonlyMap<BuildSlot, Record<string, unknown>>,
  ): CandidateClassificationResult {
    const candidateBuildFacts = new Map(buildFacts);
    candidateBuildFacts.set(slot, candidateFacts);
    const result = this.evaluate(candidateBuildFacts, [slot]).slots[0];
    if (!result) return { group: 'UNKNOWN', topReasons: [], triggeredRuleIds: [] };
    const group: CandidateCompatibilityGroup = result.status === 'COMPATIBLE'
      ? 'COMPATIBLE'
      : result.status === 'WARNING'
        ? 'COMPATIBLE_WITH_WARNINGS'
        : result.status === 'INCOMPATIBLE'
          ? 'INCOMPATIBLE'
          : 'UNKNOWN';
    return { group, topReasons: result.topReasons, triggeredRuleIds: result.triggeredRuleIds };
  }
}
