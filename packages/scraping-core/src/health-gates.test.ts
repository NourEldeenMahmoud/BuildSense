import { describe, it, expect } from 'vitest';
import { evaluateHealthGates, gateResultsToRecord } from './health-gates.js';
import type { ScrapeRunItemDocument, CategoryAuditEntry } from '@buildsense/database';

function makeItem(overrides: Record<string, unknown> = {}): ScrapeRunItemDocument {
  return {
    _id: '507f1f77bcf86cd799439011' as unknown as import('mongoose').Types.ObjectId,
    scrapeRunId: '507f1f77bcf86cd799439012' as unknown as import('mongoose').Types.ObjectId,
    canonicalUrl: 'https://example.com/product/1',
    categorySeedId: 'GPU',
    discoverySourceUrl: 'https://example.com/category/gpu',
    fetchState: 'PENDING',
    attempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as ScrapeRunItemDocument;
}

function makeCategoryAudit(overrides: Partial<CategoryAuditEntry> = {}): CategoryAuditEntry {
  return {
    seedId: 'GPU',
    pagesProcessed: 1,
    productsDiscovered: 10,
    completed: true,
    ...overrides,
  };
}

describe('health gates', () => {
  describe('empty_discovery', () => {
    it('fails when no products discovered', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 0,
      });
      const gate = result.find((g) => g.gate === 'empty_discovery');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(false);
    });

    it('passes when products discovered', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
      });
      const gate = result.find((g) => g.gate === 'empty_discovery');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(true);
    });
  });

  describe('missing_title', () => {
    it('passes when no fetched items', () => {
      const result = evaluateHealthGates({
        items: [makeItem({ fetchState: 'PENDING' })],
        totalDiscovered: 1,
      });
      const gate = result.find((g) => g.gate === 'missing_title');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(true);
    });

    it('passes when all fetched items have snapshots', () => {
      const items = [
        makeItem({ fetchState: 'FETCHED', snapshotId: 'abc' as unknown as import('mongoose').Types.ObjectId }),
        makeItem({ fetchState: 'FETCHED', snapshotId: 'def' as unknown as import('mongoose').Types.ObjectId }),
      ];
      const result = evaluateHealthGates({ items, totalDiscovered: 2 });
      const gate = result.find((g) => g.gate === 'missing_title');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(true);
    });

    it('fails when >10% of fetched items missing snapshots', () => {
      const items = [
        makeItem({ fetchState: 'FETCHED', snapshotId: 'abc' as unknown as import('mongoose').Types.ObjectId }),
        makeItem({ fetchState: 'FETCHED', snapshotId: undefined }),
        makeItem({ fetchState: 'FETCHED', snapshotId: undefined }),
      ];
      const result = evaluateHealthGates({ items, totalDiscovered: 3 });
      const gate = result.find((g) => g.gate === 'missing_title');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(false);
    });
  });

  describe('http_blocks', () => {
    it('passes when no blocked items', () => {
      const items = [
        makeItem({ fetchState: 'FETCHED' }),
        makeItem({ fetchState: 'FAILED', failureKind: 'PARSE_FAILED' }),
      ];
      const result = evaluateHealthGates({ items, totalDiscovered: 2 });
      const gate = result.find((g) => g.gate === 'http_blocks');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(true);
    });

    it('fails when >10% are blocked', () => {
      const items = [
        makeItem({ fetchState: 'FAILED', failureKind: 'HTTP_429' }),
        makeItem({ fetchState: 'FAILED', failureKind: 'HTTP_429' }),
        makeItem({ fetchState: 'FETCHED' }),
      ];
      const result = evaluateHealthGates({ items, totalDiscovered: 3 });
      const gate = result.find((g) => g.gate === 'http_blocks');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(false);
    });
  });

  describe('parser_critical', () => {
    it('passes when all fetched items have snapshots', () => {
      const items = [
        makeItem({ fetchState: 'FETCHED', snapshotId: 'abc' as unknown as import('mongoose').Types.ObjectId }),
      ];
      const result = evaluateHealthGates({ items, totalDiscovered: 1 });
      const gate = result.find((g) => g.gate === 'parser_critical');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(true);
    });

    it('fails when fetched items have no snapshots', () => {
      const items = [
        makeItem({ fetchState: 'FETCHED', snapshotId: undefined }),
      ];
      const result = evaluateHealthGates({ items, totalDiscovered: 1 });
      const gate = result.find((g) => g.gate === 'parser_critical');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(false);
    });
  });

  describe('discovery_baseline', () => {
    it('returns NO_BASELINE when no baseline provided', () => {
      const result = evaluateHealthGates({ items: [], totalDiscovered: 10 });
      const gate = result.find((g) => g.gate === 'discovery_baseline');
      expect(gate).toBeDefined();
      expect(gate!.severity).toBe('NO_BASELINE');
      expect(gate!.passed).toBe(true);
    });

    it('passes when discovery is >=40% of baseline', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 80,
        baseline: { totalDiscovered: 100 },
      });
      const gate = result.find((g) => g.gate === 'discovery_baseline');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(true);
    });

    it('fails when discovery is <40% of baseline', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 30,
        baseline: { totalDiscovered: 100 },
      });
      const gate = result.find((g) => g.gate === 'discovery_baseline');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(false);
    });
  });

  describe('empty_category', () => {
    it('returns NO_BASELINE when no baseline category audit', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
        currentCategoryAudit: [makeCategoryAudit()],
      });
      const gate = result.find((g) => g.gate === 'empty_category');
      expect(gate).toBeDefined();
      expect(gate!.severity).toBe('NO_BASELINE');
      expect(gate!.passed).toBe(true);
    });

    it('returns NO_BASELINE when no current category audit', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
        baseline: {
          totalDiscovered: 100,
          categoryAudit: [makeCategoryAudit()],
        },
      });
      const gate = result.find((g) => g.gate === 'empty_category');
      expect(gate).toBeDefined();
      expect(gate!.severity).toBe('NO_BASELINE');
      expect(gate!.passed).toBe(true);
    });

    it('passes when no previously non-empty categories become empty', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
        baseline: {
          totalDiscovered: 100,
          categoryAudit: [makeCategoryAudit({ seedId: 'GPU', productsDiscovered: 50 })],
        },
        currentCategoryAudit: [makeCategoryAudit({ seedId: 'GPU', productsDiscovered: 30 })],
      });
      const gate = result.find((g) => g.gate === 'empty_category');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(true);
    });

    it('fails when previously non-empty category becomes empty', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
        baseline: {
          totalDiscovered: 100,
          categoryAudit: [makeCategoryAudit({ seedId: 'GPU', productsDiscovered: 50 })],
        },
        currentCategoryAudit: [makeCategoryAudit({ seedId: 'GPU', productsDiscovered: 0 })],
      });
      const gate = result.find((g) => g.gate === 'empty_category');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(false);
      expect(gate!.severity).toBe('FAILED');
      expect(gate!.detail).toContain('GPU');
    });

    it('fails when previously non-empty category is absent in current', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
        baseline: {
          totalDiscovered: 100,
          categoryAudit: [makeCategoryAudit({ seedId: 'GPU', productsDiscovered: 50 })],
        },
        currentCategoryAudit: [],
      });
      const gate = result.find((g) => g.gate === 'empty_category');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(false);
      expect(gate!.severity).toBe('FAILED');
    });

    it('ignores categories that were empty in baseline', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
        baseline: {
          totalDiscovered: 100,
          categoryAudit: [makeCategoryAudit({ seedId: 'GPU', productsDiscovered: 0 })],
        },
        currentCategoryAudit: [],
      });
      const gate = result.find((g) => g.gate === 'empty_category');
      expect(gate).toBeDefined();
      expect(gate!.passed).toBe(true);
    });
  });

  describe('missing_price', () => {
    it('returns NO_BASELINE when no missing price data', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
      });
      const gate = result.find((g) => g.gate === 'missing_price');
      expect(gate).toBeDefined();
      expect(gate!.severity).toBe('NO_BASELINE');
      expect(gate!.passed).toBe(true);
    });

    it('returns NO_BASELINE when baseline exists but has no totalMissingPrice (legacy)', () => {
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
        baseline: { totalDiscovered: 100 },
        currentMissingPrice: { missing: 5, total: 100 },
      });
      const gate = result.find((g) => g.gate === 'missing_price');
      expect(gate).toBeDefined();
      expect(gate!.severity).toBe('NO_BASELINE');
      expect(gate!.passed).toBe(true);
    });

    it('returns NO_BASELINE when no baseline at all (first run) even with positive missing prices', () => {
      // Regression: first run with positive missing prices must NOT trigger zero-baseline policy.
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
        currentMissingPrice: { missing: 5, total: 100 },
      });
      const gate = result.find((g) => g.gate === 'missing_price');
      expect(gate).toBeDefined();
      expect(gate!.severity).toBe('NO_BASELINE');
      expect(gate!.passed).toBe(true);
    });

    it('uses zero-baseline policy only when explicit zero-valued baseline is present', () => {
      // Explicit zero-valued baseline triggers zero-baseline thresholds.
      const result = evaluateHealthGates({
        items: [],
        totalDiscovered: 10,
        baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
        currentMissingPrice: { missing: 4, total: 100 },
      });
      const gate = result.find((g) => g.gate === 'missing_price');
      expect(gate).toBeDefined();
      expect(gate!.severity).toBe('PARTIALLY_FAILED');
      expect(gate!.passed).toBe(false);
    });

    describe('nonzero baseline', () => {
      it('passes when growth <=30%', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 10 },
          currentMissingPrice: { missing: 12, total: 100 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(true);
        expect(gate!.severity).toBe('PARTIALLY_FAILED');
      });

      it('fails when growth >30%', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 10 },
          currentMissingPrice: { missing: 14, total: 100 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(false);
        expect(gate!.severity).toBe('PARTIALLY_FAILED');
      });

      it('uses zero-baseline policy when baseline totalMissingPrice is 0', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 0, total: 100 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(true);
      });
    });

    describe('zero baseline (explicit totalMissingPrice=0)', () => {
      it('passes when current missing is 0', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 0, total: 100 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(true);
      });

      it('returns WARNING when missing=1, total=200 (rate <=5%)', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 1, total: 200 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(true);
        expect(gate!.severity).toBe('WARNING');
        expect(gate!.reasonCode).toBe('ZERO_BASELINE_MISSING_PRICE_INCREASE');
      });

      it('returns PARTIALLY_FAILED when missing=4, total=100 (count >=3 and rate >5%)', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 4, total: 100 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(false);
        expect(gate!.severity).toBe('PARTIALLY_FAILED');
        expect(gate!.reasonCode).toBe('ZERO_BASELINE_MISSING_PRICE_INCREASE');
      });

      it('returns PARTIALLY_FAILED when missing=6, total=100 (rate >5%)', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 6, total: 100 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(false);
        expect(gate!.severity).toBe('PARTIALLY_FAILED');
      });

      it('returns WARNING at threshold boundary: missing=2, total=200 (count=2 <3, rate=1% <=5%)', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 2, total: 200 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(true);
        expect(gate!.severity).toBe('WARNING');
      });

      it('returns PARTIALLY_FAILED at threshold boundary: missing=3, total=200 (count=3 >=3)', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 3, total: 200 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(false);
        expect(gate!.severity).toBe('PARTIALLY_FAILED');
      });

      it('returns PARTIALLY_FAILED at rate boundary with count>=3: missing=10, total=200 (rate=5% exactly, count=10>=3)', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 10, total: 200 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(false);
        expect(gate!.severity).toBe('PARTIALLY_FAILED');
        expect(gate!.reasonCode).toBe('ZERO_BASELINE_MISSING_PRICE_INCREASE');
      });

      it('returns WARNING when rate=5% exactly and count<3: missing=1, total=20', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 1, total: 20 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(true);
        expect(gate!.severity).toBe('WARNING');
        expect(gate!.reasonCode).toBe('ZERO_BASELINE_MISSING_PRICE_INCREASE');
      });

      it('returns PARTIALLY_FAILED just above rate boundary: missing=11, total=200 (rate=5.5%)', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 11, total: 200 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(false);
        expect(gate!.severity).toBe('PARTIALLY_FAILED');
      });

      it('handles zero denominator safely', () => {
        const result = evaluateHealthGates({
          items: [],
          totalDiscovered: 10,
          baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
          currentMissingPrice: { missing: 0, total: 0 },
        });
        const gate = result.find((g) => g.gate === 'missing_price');
        expect(gate).toBeDefined();
        expect(gate!.passed).toBe(true);
      });
    });
  });
});

describe('gateResultsToRecord', () => {
  it('converts results to record', () => {
    const results = [
      { gate: 'empty_discovery', passed: true, severity: 'FAILED' as const },
      { gate: 'missing_title', passed: false, severity: 'FAILED' as const },
    ];
    const record = gateResultsToRecord(results);
    expect(record).toEqual({
      empty_discovery: true,
      missing_title: false,
    });
  });
});

describe('terminal status reaction to gate severities', () => {
  // The orchestrator's determineStatus checks:
  //   !g.passed && g.severity === 'FAILED'       → FAILED
  //   !g.passed && g.severity === 'PARTIALLY_FAILED' → PARTIALLY_FAILED
  // WARNING gates always have passed=true, so they never alter terminal status.

  it('WARNING gates have passed=true and do not appear as failed in gate record', () => {
    const results = evaluateHealthGates({
      items: [],
      totalDiscovered: 10,
      baseline: { totalDiscovered: 100, totalMissingPrice: 0 },
      currentMissingPrice: { missing: 1, total: 200 },
    });
    const record = gateResultsToRecord(results);
    // WARNING gate (missing_price with count<3, rate<=5%) appears as true in the record
    expect(record['missing_price']).toBe(true);
  });

  it('PARTIALLY_FAILED gate with passed=false appears as failed in gate record', () => {
    const results = evaluateHealthGates({
      items: [],
      totalDiscovered: 10,
      baseline: { totalDiscovered: 100, totalMissingPrice: 10 },
      currentMissingPrice: { missing: 14, total: 100 },
    });
    const gate = results.find((g) => g.gate === 'missing_price')!;
    expect(gate.passed).toBe(false);
    expect(gate.severity).toBe('PARTIALLY_FAILED');
    const record = gateResultsToRecord(results);
    expect(record['missing_price']).toBe(false);
  });

  it('FAILED gate with passed=false appears as failed in gate record', () => {
    const results = evaluateHealthGates({
      items: [],
      totalDiscovered: 0,
    });
    const gate = results.find((g) => g.gate === 'empty_discovery')!;
    expect(gate.passed).toBe(false);
    expect(gate.severity).toBe('FAILED');
    const record = gateResultsToRecord(results);
    expect(record['empty_discovery']).toBe(false);
  });

  it('WARNING severity never has passed=false', () => {
    // Exhaustive: every possible WARNING gate must have passed=true
    const results = evaluateHealthGates({
      items: [],
      totalDiscovered: 10,
      baseline: { totalDiscovered: 100, totalMissingPrice: 0, categoryAudit: [] },
      currentCategoryAudit: [],
      currentMissingPrice: { missing: 2, total: 200 },
    });
    for (const gate of results) {
      if (gate.severity === 'WARNING') {
        expect(gate.passed).toBe(true);
      }
    }
  });
});
