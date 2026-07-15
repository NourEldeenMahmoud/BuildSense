// ---------------------------------------------------------------------------
// Compare Query Codec
//
// Pure functions that validate and parse `left` and `right` product IDs
// from URL query parameters.  The codec is the single source of truth for
// compare-route validation states and never silently replaces malformed input.
// ---------------------------------------------------------------------------

export type CompareQueryState =
  | 'missing'
  | 'malformed-left'
  | 'malformed-right'
  | 'duplicates'
  | 'valid';

export interface CompareQueryResult {
  state: CompareQueryState;
  leftId: string | null;
  rightId: string | null;
}

/** MongoDB ObjectId pattern — 24-character hex string. */
const VALID_ID_RE = /^[0-9a-fA-F]{24}$/;

function isValidId(id: string | null | undefined): id is string {
  return typeof id === 'string' && VALID_ID_RE.test(id);
}

/**
 * Parse and validate compare query parameters.
 *
 * Evaluation order is intentionally strict:
 * 1. Both present → 2. Left valid → 3. Right valid → 4. Not duplicates.
 *
 * This ensures the caller always gets a deterministic state with no
 * silent recovery from malformed input.
 */
export function parseCompareParams(
  left: string | null | undefined,
  right: string | null | undefined
): CompareQueryResult {
  if (!left || !right) {
    return { state: 'missing', leftId: left ?? null, rightId: right ?? null };
  }

  if (!isValidId(left)) {
    return { state: 'malformed-left', leftId: left, rightId: right };
  }

  if (!isValidId(right)) {
    return { state: 'malformed-right', leftId: left, rightId: right };
  }

  if (left.toLowerCase() === right.toLowerCase()) {
    return { state: 'duplicates', leftId: left, rightId: right };
  }

  return { state: 'valid', leftId: left, rightId: right };
}

/**
 * Serialize valid IDs into query-parameter form.
 * Returns null when IDs are not both valid and distinct — the caller
 * should not navigate with an invalid state.
 */
export function serializeCompareParams(
  leftId: string,
  rightId: string
): { left: string; right: string } | null {
  if (!isValidId(leftId) || !isValidId(rightId)) {
    return null;
  }
  if (leftId.toLowerCase() === rightId.toLowerCase()) {
    return null;
  }
  return { left: leftId, right: rightId };
}
