import { describe, it, expect } from 'vitest';
import { parseCompareParams, serializeCompareParams } from './compare-query.codec';

describe('parseCompareParams', () => {
  const VALID_A = '64a000000000000000000001';
  const VALID_B = '64a000000000000000000002';

  it('returns missing when both are null/undefined', () => {
    expect(parseCompareParams(null, null).state).toBe('missing');
    expect(parseCompareParams(undefined, undefined).state).toBe('missing');
  });

  it('returns missing when only left is present', () => {
    expect(parseCompareParams(VALID_A, null).state).toBe('missing');
    expect(parseCompareParams(VALID_A, undefined).state).toBe('missing');
  });

  it('returns missing when only right is present', () => {
    expect(parseCompareParams(null, VALID_A).state).toBe('missing');
  });

  it('returns malformed-left for invalid left ID', () => {
    const result = parseCompareParams('invalid', VALID_B);
    expect(result.state).toBe('malformed-left');
    expect(result.leftId).toBe('invalid');
    expect(result.rightId).toBe(VALID_B);
  });

  it('returns malformed-left for short left ID', () => {
    expect(parseCompareParams('abc', VALID_B).state).toBe('malformed-left');
  });

  it('returns malformed-right for invalid right ID', () => {
    const result = parseCompareParams(VALID_A, 'not-a-hex-id!');
    expect(result.state).toBe('malformed-right');
    expect(result.rightId).toBe('not-a-hex-id!');
  });

  it('returns malformed-right for short right ID', () => {
    expect(parseCompareParams(VALID_A, 'short').state).toBe('malformed-right');
  });

  it('returns duplicates for same-case identical IDs', () => {
    expect(parseCompareParams(VALID_A, VALID_A).state).toBe('duplicates');
  });

  it('returns duplicates for different-case identical IDs', () => {
    const upper = '64ABCDEF1234567890ABCDEF';
    const lower = '64abcdef1234567890abcdef';
    expect(parseCompareParams(upper, lower).state).toBe('duplicates');
  });

  it('returns valid for two distinct valid IDs', () => {
    const result = parseCompareParams(VALID_A, VALID_B);
    expect(result.state).toBe('valid');
    expect(result.leftId).toBe(VALID_A);
    expect(result.rightId).toBe(VALID_B);
  });

  it('evaluates malformed-left before malformed-right', () => {
    const result = parseCompareParams('bad-left', 'bad-right');
    expect(result.state).toBe('malformed-left');
  });
});

describe('serializeCompareParams', () => {
  const VALID_A = '64a000000000000000000001';
  const VALID_B = '64a000000000000000000002';

  it('returns valid query params for distinct valid IDs', () => {
    const result = serializeCompareParams(VALID_A, VALID_B);
    expect(result).toEqual({ left: VALID_A, right: VALID_B });
  });

  it('returns null for duplicate IDs', () => {
    expect(serializeCompareParams(VALID_A, VALID_A)).toBeNull();
  });

  it('returns null for invalid left ID', () => {
    expect(serializeCompareParams('bad', VALID_B)).toBeNull();
  });

  it('returns null for invalid right ID', () => {
    expect(serializeCompareParams(VALID_A, 'bad')).toBeNull();
  });
});
