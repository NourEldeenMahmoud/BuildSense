import { describe, it, expect } from 'vitest';
import {
  canonicalizeElNourUrl,
  isElNourProductUrl,
  isElNourCategoryUrl,
  buildElNourLocalizedCategoryUrl,
  buildElNourProductUrl,
} from './urls.js';

const EL_NOUR_HOST = 'elnour-tech.com';

describe('canonicalizeElNourUrl', () => {
  it('strips UTM parameters', () => {
    const url = new URL('https://elnour-tech.com/en/product/test/?utm_source=fb&utm_medium=cpc');
    const result = canonicalizeElNourUrl(url);
    expect(result).toBe('https://elnour-tech.com/en/product/test/');
  });

  it('preserves non-tracking parameters', () => {
    const url = new URL('https://elnour-tech.com/en/product/test/?filter_brand=intel');
    const result = canonicalizeElNourUrl(url);
    expect(result).toContain('filter_brand=intel');
  });
});

describe('isElNourProductUrl', () => {
  it('returns true for product URLs', () => {
    const url = new URL('https://elnour-tech.com/en/product/amd-ryzen-5-3400g/');
    expect(isElNourProductUrl(url, EL_NOUR_HOST)).toBe(true);
  });

  it('returns false for category URLs', () => {
    const url = new URL('https://elnour-tech.com/en/product-category/pc-parts/processors/');
    expect(isElNourProductUrl(url, EL_NOUR_HOST)).toBe(false);
  });

  it('returns false for different host', () => {
    const url = new URL('https://example.com/en/product/test/');
    expect(isElNourProductUrl(url, EL_NOUR_HOST)).toBe(false);
  });
});

describe('isElNourCategoryUrl', () => {
  it('returns true for category URLs', () => {
    const url = new URL('https://elnour-tech.com/en/product-category/pc-parts/processors/');
    expect(isElNourCategoryUrl(url, EL_NOUR_HOST)).toBe(true);
  });

  it('returns false for product URLs', () => {
    const url = new URL('https://elnour-tech.com/en/product/amd-ryzen-5-3400g/');
    expect(isElNourCategoryUrl(url, EL_NOUR_HOST)).toBe(false);
  });
});

describe('buildElNourLocalizedCategoryUrl', () => {
  it('builds category URL with en locale', () => {
    const result = buildElNourLocalizedCategoryUrl('https://elnour-tech.com', 'pc-parts/processors');
    expect(result).toBe('https://elnour-tech.com/en/product-category/pc-parts/processors/');
  });

  it('builds category URL with page number', () => {
    const result = buildElNourLocalizedCategoryUrl(
      'https://elnour-tech.com',
      'pc-parts/processors',
      2,
    );
    expect(result).toContain('page/2/');
  });
});

describe('buildElNourProductUrl', () => {
  it('builds product URL from slug', () => {
    const result = buildElNourProductUrl(
      'https://elnour-tech.com',
      'amd-ryzen-5-3400g-processor',
    );
    expect(result).toBe('https://elnour-tech.com/product/amd-ryzen-5-3400g-processor/');
  });
});
