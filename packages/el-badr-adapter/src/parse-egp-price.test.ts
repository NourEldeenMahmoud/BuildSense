import { describe, it, expect } from 'vitest';
import { parseEgpPrice } from './parse-egp-price.js';

describe('parseEgpPrice', () => {
  it('parses standard EGP format', () => {
    expect(parseEgpPrice('8,299 EGP')).toBe(8299);
    expect(parseEgpPrice('6,750 EGP')).toBe(6750);
  });

  it('parses plain numbers', () => {
    expect(parseEgpPrice('8299')).toBe(8299);
    expect(parseEgpPrice('6750')).toBe(6750);
  });

  it('parses with Ex Tax prefix', () => {
    expect(parseEgpPrice('Ex Tax: 8,299 EGP')).toBe(8299);
    expect(parseEgpPrice('Ex Tax:6,750 EGP')).toBe(6750);
  });

  it('returns null for null/undefined/empty', () => {
    expect(parseEgpPrice(null)).toBeNull();
    expect(parseEgpPrice(undefined)).toBeNull();
    expect(parseEgpPrice('')).toBeNull();
    expect(parseEgpPrice('  ')).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parseEgpPrice('abc')).toBeNull();
  });

  it('parses decimal prices', () => {
    expect(parseEgpPrice('8,299.00')).toBe(8299);
    expect(parseEgpPrice('1,234.56 EGP')).toBeCloseTo(1234.56);
  });
});
