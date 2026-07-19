import { describe, it, expect } from 'vitest';
import { parseEgpPrice, parseEgpPriceRange } from './parse-egp-price.js';

describe('parseEgpPrice', () => {
  it('parses plain numbers', () => {
    expect(parseEgpPrice('3499')).toBe(3499);
  });

  it('parses Western formatted prices', () => {
    expect(parseEgpPrice('3,499.00')).toBe(3499);
  });

  it('parses prices with EGP suffix', () => {
    expect(parseEgpPrice('3,499.00 EGP')).toBe(3499);
  });

  it('parses Arabic-Indic numerals', () => {
    expect(parseEgpPrice('٣٬٤٩٩')).toBe(3499);
  });

  it('parses mixed Arabic grouping with Western digits', () => {
    expect(parseEgpPrice('٣,٤٩٩')).toBe(3499);
  });

  it('parses plain EGP without decimals', () => {
    expect(parseEgpPrice('3499 EGP')).toBe(3499);
  });

  it('returns null for null input', () => {
    expect(parseEgpPrice(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseEgpPrice(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseEgpPrice('')).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(parseEgpPrice('  ')).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parseEgpPrice('no price')).toBeNull();
  });

  it('parses prices with multiple periods as grouping', () => {
    expect(parseEgpPrice('1.234.567')).toBe(1234567);
  });
});

describe('parseEgpPriceRange', () => {
  it('parses range with en-dash', () => {
    expect(parseEgpPriceRange('6.999,00 – 8.499,00')).toBe(6999);
  });

  it('parses range with hyphen', () => {
    expect(parseEgpPriceRange('6,999 - 8,499')).toBe(6999);
  });

  it('parses single price (no range)', () => {
    expect(parseEgpPriceRange('3,499')).toBe(3499);
  });

  it('returns null for null input', () => {
    expect(parseEgpPriceRange(null)).toBeNull();
  });
});
