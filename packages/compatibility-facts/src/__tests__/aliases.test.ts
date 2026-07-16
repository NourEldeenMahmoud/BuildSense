import { describe, it, expect } from 'vitest';
import { normalizeValue } from '../helpers.js';
import {
  SOCKET_ALIASES,
  FORM_FACTOR_ALIASES,
  GENERATION_ALIASES,
  INTERFACE_ALIASES,
} from '../aliases/index.js';

describe('Alias normalization', () => {
  describe('SOCKET_ALIASES', () => {
    it('normalizes "Socket AM5" to "AM5"', () => {
      const result = normalizeValue('Socket AM5', SOCKET_ALIASES);
      expect(result.normalized).toBe('AM5');
      expect(result.wasAliased).toBe(true);
    });

    it('normalizes "LGA 1700" to "LGA1700"', () => {
      const result = normalizeValue('LGA 1700', SOCKET_ALIASES);
      expect(result.normalized).toBe('LGA1700');
      expect(result.wasAliased).toBe(true);
    });

    it('normalizes "AM4" to "AM4"', () => {
      const result = normalizeValue('AM4', SOCKET_ALIASES);
      expect(result.normalized).toBe('AM4');
      expect(result.wasAliased).toBe(true);
    });

    it('returns unnormalized value when no alias matches', () => {
      const result = normalizeValue('UNKNOWN_SOCKET', SOCKET_ALIASES);
      expect(result.normalized).toBe('UNKNOWN_SOCKET');
      expect(result.wasAliased).toBe(false);
    });
  });

  describe('FORM_FACTOR_ALIASES', () => {
    it('normalizes "Micro ATX" to "Micro-ATX"', () => {
      const result = normalizeValue('Micro ATX', FORM_FACTOR_ALIASES);
      expect(result.normalized).toBe('Micro-ATX');
      expect(result.wasAliased).toBe(true);
    });

    it('normalizes "mATX" to "Micro-ATX"', () => {
      const result = normalizeValue('mATX', FORM_FACTOR_ALIASES);
      expect(result.normalized).toBe('Micro-ATX');
      expect(result.wasAliased).toBe(true);
    });

    it('normalizes "Mini-ITX" to "Mini-ITX"', () => {
      const result = normalizeValue('Mini-ITX', FORM_FACTOR_ALIASES);
      expect(result.normalized).toBe('Mini-ITX');
      expect(result.wasAliased).toBe(true);
    });

    it('normalizes "ATX" to "ATX"', () => {
      const result = normalizeValue('ATX', FORM_FACTOR_ALIASES);
      expect(result.normalized).toBe('ATX');
      expect(result.wasAliased).toBe(true);
    });
  });

  describe('GENERATION_ALIASES', () => {
    it('normalizes "DDR 5" to "DDR5"', () => {
      const result = normalizeValue('DDR 5', GENERATION_ALIASES);
      expect(result.normalized).toBe('DDR5');
      expect(result.wasAliased).toBe(true);
    });

    it('normalizes "ddr4" to "DDR4"', () => {
      const result = normalizeValue('ddr4', GENERATION_ALIASES);
      expect(result.normalized).toBe('DDR4');
      expect(result.wasAliased).toBe(true);
    });
  });

  describe('INTERFACE_ALIASES', () => {
    it('normalizes "SATA III" to "SATA"', () => {
      const result = normalizeValue('SATA III', INTERFACE_ALIASES);
      expect(result.normalized).toBe('SATA');
      expect(result.wasAliased).toBe(true);
    });

    it('normalizes "NVMe PCIe 4.0" to "NVMe"', () => {
      const result = normalizeValue('NVMe PCIe 4.0', INTERFACE_ALIASES);
      expect(result.normalized).toBe('NVMe');
      expect(result.wasAliased).toBe(true);
    });

    it('normalizes "PCIe Gen 4" to "PCIe"', () => {
      const result = normalizeValue('PCIe Gen 4', INTERFACE_ALIASES);
      expect(result.normalized).toBe('PCIe');
      expect(result.wasAliased).toBe(true);
    });
  });
});
