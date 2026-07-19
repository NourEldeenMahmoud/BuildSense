import { describe, it, expect } from 'vitest';
import { EL_BADR_STORE_CODE, EL_BADR_PARSER_VERSION, normalizeExternalId, isValidElBadrExternalId } from './identity.js';

describe('El Badr identity', () => {
  it('has correct store code', () => {
    expect(EL_BADR_STORE_CODE).toBe('EL_BADR');
  });

  it('has parser version', () => {
    expect(EL_BADR_PARSER_VERSION).toBe('0.1.0');
  });

  describe('normalizeExternalId', () => {
    it('returns null for null/undefined/empty', () => {
      expect(normalizeExternalId(null)).toBeNull();
      expect(normalizeExternalId(undefined)).toBeNull();
      expect(normalizeExternalId('')).toBeNull();
      expect(normalizeExternalId('  ')).toBeNull();
    });

    it('returns numeric IDs', () => {
      expect(normalizeExternalId('7543')).toBe('7543');
      expect(normalizeExternalId('  7543  ')).toBe('7543');
    });

    it('returns null for non-numeric IDs', () => {
      expect(normalizeExternalId('abc')).toBeNull();
      expect(normalizeExternalId('7543abc')).toBeNull();
    });
  });

  describe('isValidElBadrExternalId', () => {
    it('validates numeric IDs', () => {
      expect(isValidElBadrExternalId('7543')).toBe(true);
      expect(isValidElBadrExternalId(null)).toBe(false);
      expect(isValidElBadrExternalId('abc')).toBe(false);
    });
  });
});
