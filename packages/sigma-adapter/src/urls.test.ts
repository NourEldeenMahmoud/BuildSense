import { describe, expect, it } from 'vitest';
import {
  canonicalizeSigmaUrl,
  isSigmaProductUrl,
  isSigmaCategoryUrl,
  extractSigmaCategoryId,
  extractProductSlugFromUrl,
  buildSigmaCategoryUrl,
  buildSigmaProductUrl,
  hashUrlForFilename,
} from './urls.js';

const SIGMA_HOST = 'www.sigma-computer.com';

describe('canonicalizeSigmaUrl', () => {
  it('strips UTM tracking parameters', () => {
    const url = new URL(
      'https://www.sigma-computer.com/en/category/abc-123?utm_source=google&utm_medium=cpc&page=2',
    );
    const result = canonicalizeSigmaUrl(url);
    expect(result).toBe(
      'https://www.sigma-computer.com/en/category/abc-123?page=2',
    );
  });

  it('preserves non-tracking query parameters', () => {
    const url = new URL(
      'https://www.sigma-computer.com/en/item?id=test-product-abc123&variant=blue',
    );
    const result = canonicalizeSigmaUrl(url);
    expect(result).toContain('id=test-product-abc123');
    expect(result).toContain('variant=blue');
  });

  it('returns clean URL when no query parameters', () => {
    const url = new URL('https://www.sigma-computer.com/en/category/abc-123');
    const result = canonicalizeSigmaUrl(url);
    expect(result).toBe('https://www.sigma-computer.com/en/category/abc-123');
  });
});

describe('isSigmaProductUrl', () => {
  it('returns true for valid Sigma product URLs', () => {
    const url = new URL(
      'https://www.sigma-computer.com/en/item?id=test-product-abc123',
    );
    expect(isSigmaProductUrl(url, SIGMA_HOST)).toBe(true);
  });

  it('returns false for category URLs', () => {
    const url = new URL(
      'https://www.sigma-computer.com/en/category/abc-123',
    );
    expect(isSigmaProductUrl(url, SIGMA_HOST)).toBe(false);
  });

  it('returns false for different host', () => {
    const url = new URL('https://example.com/en/item?id=test-product-abc123');
    expect(isSigmaProductUrl(url, SIGMA_HOST)).toBe(false);
  });
});

describe('isSigmaCategoryUrl', () => {
  it('returns true for valid Sigma category URLs', () => {
    const url = new URL(
      'https://www.sigma-computer.com/en/category/9f503b67-b433-4434-8879-ebd003dce713',
    );
    expect(isSigmaCategoryUrl(url, SIGMA_HOST)).toBe(true);
  });

  it('returns false for product URLs', () => {
    const url = new URL(
      'https://www.sigma-computer.com/en/item?id=test-product-abc123',
    );
    expect(isSigmaCategoryUrl(url, SIGMA_HOST)).toBe(false);
  });
});

describe('extractSigmaCategoryId', () => {
  it('extracts UUID from category URL', () => {
    const url = new URL(
      'https://www.sigma-computer.com/en/category/9f503b67-b433-4434-8879-ebd003dce713',
    );
    expect(extractSigmaCategoryId(url)).toBe(
      '9f503b67-b433-4434-8879-ebd003dce713',
    );
  });

  it('returns null for non-category URLs', () => {
    const url = new URL(
      'https://www.sigma-computer.com/en/item?id=test-product-abc123',
    );
    expect(extractSigmaCategoryId(url)).toBeNull();
  });
});

describe('extractProductSlugFromUrl', () => {
  it('extracts full ID parameter as slug', () => {
    const url = new URL(
      'https://www.sigma-computer.com/en/item?id=amd-ryzen-7-9700x-8c16t-38ghz55ghz-32mb-65w-tdp-socket-am5-lga-1718-trayfan-bn9kn1xohmvc',
    );
    expect(extractProductSlugFromUrl(url)).toBe(
      'amd-ryzen-7-9700x-8c16t-38ghz55ghz-32mb-65w-tdp-socket-am5-lga-1718-trayfan-bn9kn1xohmvc',
    );
  });

  it('returns null when no id parameter', () => {
    const url = new URL('https://www.sigma-computer.com/en/item');
    expect(extractProductSlugFromUrl(url)).toBeNull();
  });
});

describe('buildSigmaCategoryUrl', () => {
  it('builds category URL without page', () => {
    const result = buildSigmaCategoryUrl(
      'https://www.sigma-computer.com',
      '9f503b67-b433-4434-8879-ebd003dce713',
    );
    expect(result).toBe(
      'https://www.sigma-computer.com/en/category/9f503b67-b433-4434-8879-ebd003dce713',
    );
  });

  it('builds category URL with page', () => {
    const result = buildSigmaCategoryUrl(
      'https://www.sigma-computer.com',
      '9f503b67-b433-4434-8879-ebd003dce713',
      2,
    );
    expect(result).toContain('page=2');
  });

  it('omits page param for page 1', () => {
    const result = buildSigmaCategoryUrl(
      'https://www.sigma-computer.com',
      '9f503b67-b433-4434-8879-ebd003dce713',
      1,
    );
    expect(result).not.toContain('page=');
  });
});

describe('buildSigmaProductUrl', () => {
  it('builds product URL with id parameter', () => {
    const result = buildSigmaProductUrl(
      'https://www.sigma-computer.com',
      'test-product-abc123',
    );
    expect(result).toBe(
      'https://www.sigma-computer.com/en/item?id=test-product-abc123',
    );
  });
});

describe('hashUrlForFilename', () => {
  it('returns consistent hash for same URL', () => {
    const hash1 = hashUrlForFilename('https://example.com/test');
    const hash2 = hashUrlForFilename('https://example.com/test');
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different URLs', () => {
    const hash1 = hashUrlForFilename('https://example.com/test1');
    const hash2 = hashUrlForFilename('https://example.com/test2');
    expect(hash1).not.toBe(hash2);
  });

  it('returns alphanumeric string suitable for filenames', () => {
    const hash = hashUrlForFilename('https://example.com/test');
    expect(hash).toMatch(/^[a-z0-9]+$/);
    expect(hash.length).toBeLessThanOrEqual(8);
  });
});
