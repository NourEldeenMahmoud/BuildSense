import { describe, expect, it } from 'vitest';
import {
  SIGMA_PARSER_VERSION,
  SIGMA_STORE_CODE,
  isValidSigmaExternalId,
  normalizeExternalId,
} from './identity.js';

describe('constants', () => {
  it('exports parser version as semver string', () => {
    expect(SIGMA_PARSER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exports store code as SIGMA', () => {
    expect(SIGMA_STORE_CODE).toBe('SIGMA');
  });
});

describe('isValidSigmaExternalId', () => {
  it('returns true for valid UUID', () => {
    expect(isValidSigmaExternalId('9f503b67-b433-4434-8879-ebd003dce713')).toBe(
      true,
    );
  });

  it('returns false for null', () => {
    expect(isValidSigmaExternalId(null)).toBe(false);
  });

  it('returns false for non-UUID strings', () => {
    expect(isValidSigmaExternalId('not-a-uuid')).toBe(false);
    expect(isValidSigmaExternalId('abc123')).toBe(false);
    expect(isValidSigmaExternalId('')).toBe(false);
  });

  it('returns false for uppercase UUID (not normalized)', () => {
    expect(isValidSigmaExternalId('9F503B67-B433-4434-8879-EBD003DCE713')).toBe(
      true,
    );
  });
});

describe('normalizeExternalId', () => {
  it('returns lowercase UUID for valid input', () => {
    expect(
      normalizeExternalId('9F503B67-B433-4434-8879-EBD003DCE713'),
    ).toBe('9f503b67-b433-4434-8879-ebd003dce713');
  });

  it('returns null for null input', () => {
    expect(normalizeExternalId(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeExternalId(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeExternalId('')).toBeNull();
  });

  it('returns null for non-UUID string', () => {
    expect(normalizeExternalId('not-a-uuid')).toBeNull();
  });

  it('trims whitespace before validation', () => {
    expect(
      normalizeExternalId('  9f503b67-b433-4434-8879-ebd003dce713  '),
    ).toBe('9f503b67-b433-4434-8879-ebd003dce713');
  });
});
