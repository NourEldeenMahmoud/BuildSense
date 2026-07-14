import { describe, it, expect } from 'vitest';
import {
  calculateExpectedPages,
  generateCategoryPageUrls,
  computeMissingPages,
  dedupeCanonicalUrls,
  buildFetchPlan,
  detectSilentSkips,
  isRetryEligibleFailure,
  assertBootstrapResumeCompatibility,
} from './bootstrap-import.js';

describe('bootstrap import helpers', () => {
  it('calculates expected pages using ceil(totalItems/16)', () => {
    expect(calculateExpectedPages(1)).toBe(1);
    expect(calculateExpectedPages(16)).toBe(1);
    expect(calculateExpectedPages(17)).toBe(2);
    expect(calculateExpectedPages(33)).toBe(3);
  });

  it('generates all pages upfront from page 1 to expected page count', () => {
    const urls = generateCategoryPageUrls(
      'https://www.sigma-computer.com/en/category/9f503b67-b433-4434-8879-ebd003dce713',
      4,
    );

    expect(urls).toEqual([
      'https://www.sigma-computer.com/en/category/9f503b67-b433-4434-8879-ebd003dce713',
      'https://www.sigma-computer.com/en/category/9f503b67-b433-4434-8879-ebd003dce713?page=2',
      'https://www.sigma-computer.com/en/category/9f503b67-b433-4434-8879-ebd003dce713?page=3',
      'https://www.sigma-computer.com/en/category/9f503b67-b433-4434-8879-ebd003dce713?page=4',
    ]);
  });

  it('detects missing pages for completeness check', () => {
    const generated = [
      'https://www.sigma-computer.com/en/category/a',
      'https://www.sigma-computer.com/en/category/a?page=2',
      'https://www.sigma-computer.com/en/category/a?page=3',
    ];

    const missing = computeMissingPages(generated, [
      'https://www.sigma-computer.com/en/category/a',
      'https://www.sigma-computer.com/en/category/a?page=3',
    ]);

    expect(missing).toEqual(['https://www.sigma-computer.com/en/category/a?page=2']);
  });

  it('canonical URL dedupe returns unique list with duplicate count', () => {
    const deduped = dedupeCanonicalUrls([
      'https://www.sigma-computer.com/en/item?id=a',
      'https://www.sigma-computer.com/en/item?id=b',
      'https://www.sigma-computer.com/en/item?id=a',
      'https://www.sigma-computer.com/en/item?id=b',
      'https://www.sigma-computer.com/en/item?id=c',
    ]);

    expect(deduped.uniqueUrls).toEqual([
      'https://www.sigma-computer.com/en/item?id=a',
      'https://www.sigma-computer.com/en/item?id=b',
      'https://www.sigma-computer.com/en/item?id=c',
    ]);
    expect(deduped.duplicateCount).toBe(2);
  });

  it('builds safe resume fetch plan and avoids duplicate logical fetches', () => {
    const plan = buildFetchPlan([
      { canonicalUrl: 'https://www.sigma-computer.com/en/item?id=a', fetchState: 'PENDING' },
      { canonicalUrl: 'https://www.sigma-computer.com/en/item?id=a', fetchState: 'PENDING' },
      { canonicalUrl: 'https://www.sigma-computer.com/en/item?id=b', fetchState: 'FETCHED' },
      {
        canonicalUrl: 'https://www.sigma-computer.com/en/item?id=c',
        fetchState: 'FAILED',
        failureKind: 'PARSE_FAILED',
      },
      { canonicalUrl: 'https://www.sigma-computer.com/en/item?id=d', fetchState: 'SKIPPED' },
      { canonicalUrl: 'https://www.sigma-computer.com/en/item?id=e', fetchState: 'PENDING' },
    ]);

    expect(plan.scheduled).toEqual([
      'https://www.sigma-computer.com/en/item?id=a',
      'https://www.sigma-computer.com/en/item?id=e',
    ]);
    expect(plan.skippedOrResumed).toBe(3);
    expect(plan.duplicateLogicalFetches).toBe(1);
  });

  it.each(['NETWORK', 'TIMEOUT', 'HTTP_408', 'HTTP_429', 'HTTP_5XX'] as const)(
    'reschedules %s failures on resume',
    (failureKind) => {
      const url = `https://www.sigma-computer.com/en/item?id=${failureKind}`;
      const plan = buildFetchPlan([{ canonicalUrl: url, fetchState: 'FAILED', failureKind }]);

      expect(isRetryEligibleFailure(failureKind)).toBe(true);
      expect(plan.scheduled).toEqual([url]);
      expect(plan.skippedOrResumed).toBe(0);
    },
  );

  it.each(['HTTP_4XX', 'PARSE_FAILED', 'PERSISTENCE_FAILED', undefined] as const)(
    'does not reschedule non-retryable failure %s by default',
    (failureKind) => {
      const item = {
        canonicalUrl: 'https://www.sigma-computer.com/en/item?id=terminal-failure',
        fetchState: 'FAILED' as const,
        ...(failureKind !== undefined && { failureKind }),
      };
      const plan = buildFetchPlan([item]);

      expect(plan.scheduled).toEqual([]);
      expect(plan.skippedOrResumed).toBe(1);
    },
  );

  it.each([
    { fetchState: 'PENDING' as const },
    { fetchState: 'FAILED' as const, failureKind: 'NETWORK' as const },
  ])(
    'does not schedule a duplicate $fetchState item when the logical URL already fetched',
    (duplicate) => {
      const url = 'https://www.sigma-computer.com/en/item?id=already-fetched';
      const plan = buildFetchPlan([
        duplicate.failureKind === undefined
          ? { canonicalUrl: url, fetchState: duplicate.fetchState }
          : {
              canonicalUrl: url,
              fetchState: duplicate.fetchState,
              failureKind: duplicate.failureKind,
            },
        { canonicalUrl: url, fetchState: 'FETCHED' },
      ]);

      expect(plan.scheduled).toEqual([]);
      expect(plan.skippedOrResumed).toBe(1);
      expect(plan.duplicateLogicalFetches).toBe(1);
    },
  );

  it('accepts compatible full and category resumes', () => {
    expect(() =>
      assertBootstrapResumeCompatibility(
        {
          runId: 'full-run',
          mode: 'FULL',
          commandInput: JSON.stringify({ mode: 'BOOTSTRAP_IMPORT' }),
        },
        {},
      ),
    ).not.toThrow();

    expect(() =>
      assertBootstrapResumeCompatibility(
        {
          runId: 'category-run',
          mode: 'CATEGORY',
          commandInput: JSON.stringify({ mode: 'BOOTSTRAP_IMPORT', seedId: 'GPU' }),
        },
        { seedId: 'GPU' },
      ),
    ).not.toThrow();
  });

  it('rejects resume attempts with an incompatible mode or seed input', () => {
    expect(() =>
      assertBootstrapResumeCompatibility(
        {
          runId: 'category-run',
          mode: 'CATEGORY',
          commandInput: JSON.stringify({ mode: 'BOOTSTRAP_IMPORT', seedId: 'GPU' }),
        },
        { seedId: 'CPU' },
      ),
    ).toThrow('incompatible with the requested bootstrap mode or seed');

    expect(() =>
      assertBootstrapResumeCompatibility(
        {
          runId: 'full-run',
          mode: 'FULL',
          commandInput: JSON.stringify({ mode: 'BOOTSTRAP_IMPORT' }),
        },
        { seedId: 'GPU' },
      ),
    ).toThrow('incompatible with the requested bootstrap mode or seed');

    expect(() =>
      assertBootstrapResumeCompatibility(
        {
          runId: 'wrong-command-run',
          mode: 'FULL',
          commandInput: JSON.stringify({ mode: 'LIVE_IMPORT' }),
        },
        {},
      ),
    ).toThrow('incompatible with the requested bootstrap mode or seed');
  });

  it('detects silent skips when totals do not reconcile', () => {
    expect(detectSilentSkips(100, 70, 20, 10)).toBe(0);
    expect(detectSilentSkips(100, 70, 20, 5)).toBe(5);
  });

  it('marks incomplete status conditions via missing pages and duplicate logical fetches inputs', () => {
    const missing = computeMissingPages(
      [
        'https://www.sigma-computer.com/en/category/a',
        'https://www.sigma-computer.com/en/category/a?page=2',
      ],
      ['https://www.sigma-computer.com/en/category/a'],
    );

    const plan = buildFetchPlan([
      { canonicalUrl: 'https://www.sigma-computer.com/en/item?id=a', fetchState: 'PENDING' },
      { canonicalUrl: 'https://www.sigma-computer.com/en/item?id=a', fetchState: 'PENDING' },
    ]);

    const silent = detectSilentSkips(1, 0, 0, 0);

    expect(missing.length).toBeGreaterThan(0);
    expect(plan.duplicateLogicalFetches).toBeGreaterThan(0);
    expect(silent).toBeGreaterThan(0);
  });
});
