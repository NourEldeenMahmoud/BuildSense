import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import { CatalogProductRepository, parseExtractorVersion, compareExtractorVersions } from './catalog-product-repository.js';
import { CatalogProductModel } from '../models/catalog-product.js';
import type { CompatibilityFactSet } from './catalog-product-repository.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFactSet(overrides?: { extractorVersion?: string; category?: string }): CompatibilityFactSet {
  return {
    category: overrides?.category ?? 'CPU',
    extractorVersion: overrides?.extractorVersion ?? 'cpu/v1.0.0',
    facts: [
      {
        key: 'cpu.socket',
        value: 'AM5',
        evidence: [
          {
            sourceLabel: 'Socket',
            rawValue: 'Socket AM5',
            normalizedValue: 'AM5',
            confidence: 0.95,
            extractorVersion: overrides?.extractorVersion ?? 'cpu/v1.0.0',
            extractionIssues: [],
          },
        ],
      },
    ],
    extractedAt: '2026-07-16T00:00:00.000Z',
    extractionIssues: [],
  };
}

function makeProduct(overrides?: { category?: string; compatibility?: unknown }) {
  return {
    title: `Product ${Math.random().toString(36).slice(2, 8)}`,
    category: overrides?.category ?? 'CPU',
    rawSpecifications: [{ label: 'Socket', value: 'Socket AM5' }],
    compatibility: overrides?.compatibility ?? null,
    buildEligibility: 'ELIGIBLE' as const,
  };
}

async function seedProducts(count: number, category = 'CPU'): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const doc = await CatalogProductModel.create(makeProduct({ category }));
    ids.push(String(doc._id));
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseExtractorVersion', () => {
  it('parses valid version string', () => {
    const result = parseExtractorVersion('cpu/v1.0.0');
    expect(result).toEqual(['cpu', 1, 0, 0]);
  });

  it('parses version with multiple digits', () => {
    const result = parseExtractorVersion('mb/v12.34.56');
    expect(result).toEqual(['mb', 12, 34, 56]);
  });

  it('returns null for malformed version', () => {
    expect(parseExtractorVersion('invalid')).toBeNull();
    expect(parseExtractorVersion('cpu/1.0.0')).toBeNull();
    expect(parseExtractorVersion('cpu/v1.0')).toBeNull();
  });
});

describe('compareExtractorVersions', () => {
  it('returns 0 for same version', () => {
    expect(compareExtractorVersions('cpu/v1.0.0', 'cpu/v1.0.0')).toBe(0);
  });

  it('returns positive for newer version', () => {
    expect(compareExtractorVersions('cpu/v1.0.1', 'cpu/v1.0.0')).toBeGreaterThan(0);
    expect(compareExtractorVersions('cpu/v1.1.0', 'cpu/v1.0.0')).toBeGreaterThan(0);
    expect(compareExtractorVersions('cpu/v2.0.0', 'cpu/v1.0.0')).toBeGreaterThan(0);
  });

  it('returns negative for older version', () => {
    expect(compareExtractorVersions('cpu/v1.0.0', 'cpu/v1.0.1')).toBeLessThan(0);
    expect(compareExtractorVersions('cpu/v1.0.0', 'cpu/v1.1.0')).toBeLessThan(0);
    expect(compareExtractorVersions('cpu/v1.0.0', 'cpu/v2.0.0')).toBeLessThan(0);
  });

  it('returns 0 for different categories (cannot compare)', () => {
    expect(compareExtractorVersions('cpu/v1.0.0', 'mb/v1.0.0')).toBe(0);
  });

  it('returns 0 for malformed versions', () => {
    expect(compareExtractorVersions('invalid', 'cpu/v1.0.0')).toBe(0);
    expect(compareExtractorVersions('cpu/v1.0.0', 'invalid')).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Req 2: Semantic version comparison — numeric, not lexicographic
  // -------------------------------------------------------------------------

  it('v1.10.0 is greater than v1.2.0 (numeric, not lexicographic)', () => {
    expect(compareExtractorVersions('cpu/v1.10.0', 'cpu/v1.2.0')).toBeGreaterThan(0);
  });

  it('v1.2.0 is less than v1.10.0', () => {
    expect(compareExtractorVersions('cpu/v1.2.0', 'cpu/v1.10.0')).toBeLessThan(0);
  });

  it('v10.0.0 is greater than v2.9.9', () => {
    expect(compareExtractorVersions('cpu/v10.0.0', 'cpu/v2.9.9')).toBeGreaterThan(0);
  });

  it('v0.0.1 is less than v0.1.0', () => {
    expect(compareExtractorVersions('cpu/v0.0.1', 'cpu/v0.1.0')).toBeLessThan(0);
  });

  it('handles large patch numbers correctly', () => {
    expect(compareExtractorVersions('gpu/v1.0.999', 'gpu/v1.0.100')).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Req 2: Category mismatch and malformed versions
  // -------------------------------------------------------------------------

  it('returns 0 for mismatched categories regardless of numeric version', () => {
    // cpu/v2.0.0 vs mb/v1.0.0 — categories differ, returns 0
    expect(compareExtractorVersions('cpu/v2.0.0', 'mb/v1.0.0')).toBe(0);
    // Both malformed
    expect(compareExtractorVersions('bad', 'worse')).toBe(0);
    // One malformed, one valid
    expect(compareExtractorVersions('cpu/v1.0.0', 'bad')).toBe(0);
    expect(compareExtractorVersions('bad', 'cpu/v1.0.0')).toBe(0);
  });

  it('malformed versions are treated as equal (safe default)', () => {
    expect(compareExtractorVersions('not-a-version', 'also-not-a-version')).toBe(0);
  });
});

describe('CatalogProductRepository', () => {
  let repo: CatalogProductRepository;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    repo = new CatalogProductRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // -------------------------------------------------------------------------
  // iterateBatch
  // -------------------------------------------------------------------------

  describe('iterateBatch', () => {
    it('returns products in _id order', async () => {
      const ids = await seedProducts(5);

      const batch = await repo.iterateBatch({ batchSize: 10 });
      expect(batch).toHaveLength(5);
      expect(batch.map((d) => String(d._id))).toEqual(ids);
    });

    it('respects batchSize limit', async () => {
      await seedProducts(10);

      const batch = await repo.iterateBatch({ batchSize: 3 });
      expect(batch).toHaveLength(3);
    });

    it('paginates with cursor (afterId)', async () => {
      const ids = await seedProducts(5);

      const page1 = await repo.iterateBatch({ batchSize: 2 });
      expect(page1).toHaveLength(2);

      const page2 = await repo.iterateBatch({
        batchSize: 2,
        afterId: String(page1[page1.length - 1]!._id),
      });
      expect(page2).toHaveLength(2);
      expect(String(page2[0]!._id)).toBe(ids[2]);

      const page3 = await repo.iterateBatch({
        batchSize: 2,
        afterId: String(page2[page2.length - 1]!._id),
      });
      expect(page3).toHaveLength(1);
    });

    it('filters by category', async () => {
      await seedProducts(3, 'CPU');
      await seedProducts(2, 'GPU');

      const cpuBatch = await repo.iterateBatch({ batchSize: 10, category: 'CPU' });
      expect(cpuBatch).toHaveLength(3);

      const gpuBatch = await repo.iterateBatch({ batchSize: 10, category: 'GPU' });
      expect(gpuBatch).toHaveLength(2);
    });

    it('returns empty array when no products match', async () => {
      await seedProducts(2, 'CPU');
      const batch = await repo.iterateBatch({ batchSize: 10, category: 'GPU' });
      expect(batch).toHaveLength(0);
    });

    it('returns empty array when cursor exceeds all documents', async () => {
      await seedProducts(3);
      const ids = await seedProducts(3);

      const batch = await repo.iterateBatch({
        batchSize: 10,
        afterId: ids[ids.length - 1]!,
      });
      expect(batch).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // findNeedingExtraction
  // -------------------------------------------------------------------------

  describe('findNeedingExtraction', () => {
    it('finds products with null compatibility', async () => {
      await seedProducts(3, 'CPU');

      const needing = await repo.findNeedingExtraction('CPU', 'cpu/v1.0.0', 10);
      expect(needing).toHaveLength(3);
    });

    it('finds products with different extractor version', async () => {
      await CatalogProductModel.create(
        makeProduct({ category: 'CPU', compatibility: makeFactSet({ extractorVersion: 'cpu/v0.9.0' }) }),
      );

      const needing = await repo.findNeedingExtraction('CPU', 'cpu/v1.0.0', 10);
      expect(needing).toHaveLength(1);
    });

    it('finds products with legacy empty extractorVersion', async () => {
      await CatalogProductModel.create(
        makeProduct({ category: 'CPU', compatibility: { category: '', extractorVersion: '', facts: [], extractedAt: '', extractionIssues: [] } }),
      );

      const needing = await repo.findNeedingExtraction('CPU', 'cpu/v1.0.0', 10);
      expect(needing).toHaveLength(1);
    });

    it('excludes products with matching extractorVersion', async () => {
      await CatalogProductModel.create(
        makeProduct({ category: 'CPU', compatibility: makeFactSet({ extractorVersion: 'cpu/v1.0.0' }) }),
      );

      const needing = await repo.findNeedingExtraction('CPU', 'cpu/v1.0.0', 10);
      expect(needing).toHaveLength(0);
    });

    it('only finds products in the specified category', async () => {
      await CatalogProductModel.create(makeProduct({ category: 'GPU', compatibility: null }));

      const needing = await repo.findNeedingExtraction('CPU', 'cpu/v1.0.0', 10);
      expect(needing).toHaveLength(0);
    });

    it('paginates with afterId cursor', async () => {
      await seedProducts(5, 'CPU');

      const page1 = await repo.findNeedingExtraction('CPU', 'cpu/v1.0.0', 2);
      expect(page1).toHaveLength(2);

      const page2 = await repo.findNeedingExtraction(
        'CPU',
        'cpu/v1.0.0',
        2,
        String(page1[page1.length - 1]!._id),
      );
      expect(page2).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // persistFacts
  // -------------------------------------------------------------------------

  describe('persistFacts', () => {
    it('writes fact set to product with null compatibility', async () => {
      const ids = await seedProducts(1);
      const id = ids[0]!;
      const factSet = makeFactSet();

      const result = await repo.persistFacts(id, factSet);
      expect(result.kind).toBe('updated');

      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility).not.toBeNull();
      expect(doc?.compatibility?.extractorVersion).toBe('cpu/v1.0.0');
      expect(doc?.compatibility?.facts).toHaveLength(1);
      expect(doc?.compatibility?.facts[0]?.key).toBe('cpu.socket');
    });

    it('skips with same_version when not forced', async () => {
      const ids = await seedProducts(1); const id = ids[0]!;
      const factSet = makeFactSet();

      await repo.persistFacts(id, factSet);
      // Update the extractedAt to simulate a retry
      const retrySet = { ...factSet, extractedAt: '2026-07-17T00:00:00.000Z' };
      const result = await repo.persistFacts(id, retrySet, false);

      expect(result.kind).toBe('skipped');
      if (result.kind === 'skipped') {
        expect(result.reason).toBe('same_version');
      }
      // Document should NOT be updated
      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility?.extractedAt).toBe('2026-07-16T00:00:00.000Z');
    });

    it('updates with same_version when forced', async () => {
      const ids = await seedProducts(1); const id = ids[0]!;
      const factSet = makeFactSet();

      await repo.persistFacts(id, factSet);
      // Update the extractedAt to simulate a retry
      const retrySet = { ...factSet, extractedAt: '2026-07-17T00:00:00.000Z' };
      const result = await repo.persistFacts(id, retrySet, true);

      expect(result.kind).toBe('updated');
      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility?.extractedAt).toBe('2026-07-17T00:00:00.000Z');
    });

    it('updates with newer version', async () => {
      const ids = await seedProducts(1); const id = ids[0]!;
      await repo.persistFacts(id, makeFactSet({ extractorVersion: 'cpu/v0.9.0' }));

      const result = await repo.persistFacts(id, makeFactSet({ extractorVersion: 'cpu/v1.0.0' }));
      expect(result.kind).toBe('updated');

      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility?.extractorVersion).toBe('cpu/v1.0.0');
    });

    it('returns stale for older version without force', async () => {
      const ids = await seedProducts(1); const id = ids[0]!;
      await repo.persistFacts(id, makeFactSet({ extractorVersion: 'cpu/v2.0.0' }));

      const result = await repo.persistFacts(id, makeFactSet({ extractorVersion: 'cpu/v1.0.0' }), false);
      expect(result.kind).toBe('stale');
      if (result.kind === 'stale') {
        expect(result.currentVersion).toBe('cpu/v2.0.0');
      }

      // Document should NOT be downgraded
      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility?.extractorVersion).toBe('cpu/v2.0.0');
    });

    it('returns stale for older version when forced (force cannot downgrade)', async () => {
      const ids = await seedProducts(1); const id = ids[0]!;
      await repo.persistFacts(id, makeFactSet({ extractorVersion: 'cpu/v2.0.0' }));

      const result = await repo.persistFacts(id, makeFactSet({ extractorVersion: 'cpu/v1.0.0' }), true);
      expect(result.kind).toBe('stale');
      if (result.kind === 'stale') {
        expect(result.currentVersion).toBe('cpu/v2.0.0');
      }

      // Document should NOT be downgraded even with force
      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility?.extractorVersion).toBe('cpu/v2.0.0');
    });

    it('returns not_found for non-existent product', async () => {
      const result = await repo.persistFacts('000000000000000000000000', makeFactSet());
      expect(result.kind).toBe('skipped');
      if (result.kind === 'skipped') {
        expect(result.reason).toBe('not_found');
      }
    });

    // -----------------------------------------------------------------------
    // Req 1: Category mismatch and malformed version safety
    // -----------------------------------------------------------------------

    it('rejects fact set with product category mismatch', async () => {
      const ids = await seedProducts(1, 'GPU');
      const id = ids[0]!;
      const cpuFactSet = makeFactSet({ category: 'CPU', extractorVersion: 'cpu/v1.0.0' });

      const result = await repo.persistFacts(id, cpuFactSet);
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.reason).toBe('product_category_mismatch');
      }

      // Document unchanged — no write occurred
      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility).toBeNull();
    });

    it('rejects category mismatch even with force', async () => {
      const ids = await seedProducts(1, 'GPU');
      const id = ids[0]!;
      const cpuFactSet = makeFactSet({ category: 'CPU', extractorVersion: 'cpu/v1.0.0' });

      const result = await repo.persistFacts(id, cpuFactSet, true);
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.reason).toBe('product_category_mismatch');
      }

      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility).toBeNull();
    });

    it('rejects fact set with malformed incoming version', async () => {
      const ids = await seedProducts(1);
      const id = ids[0]!;
      const badFactSet = makeFactSet({ extractorVersion: 'invalid-version' });

      const result = await repo.persistFacts(id, badFactSet);
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.reason).toBe('malformed_incoming_version');
      }

      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility).toBeNull();
    });

    it('rejects fact set where version category prefix does not match factSet.category', async () => {
      const ids = await seedProducts(1);
      const id = ids[0]!;
      // category is 'CPU' but extractorVersion has 'gpu/' prefix
      const badFactSet = makeFactSet({ category: 'CPU', extractorVersion: 'gpu/v1.0.0' });

      const result = await repo.persistFacts(id, badFactSet);
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.reason).toBe('factset_category_mismatch');
      }

      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility).toBeNull();
    });

    it('accepts the mb version prefix for a motherboard product', async () => {
      const ids = await seedProducts(1, 'motherboard');
      const factSet = makeFactSet({
        category: 'Motherboard',
        extractorVersion: 'mb/v1.0.0',
      });

      const result = await repo.persistFacts(ids[0]!, factSet);

      expect(result.kind).toBe('updated');
      const doc = await CatalogProductModel.findById(ids[0]);
      expect(doc?.compatibility?.extractorVersion).toBe('mb/v1.0.0');
    });

    it('rejects write when stored version is malformed', async () => {
      const ids = await seedProducts(1);
      const id = ids[0]!;
      // Seed product with malformed stored version
      await CatalogProductModel.findByIdAndUpdate(id, {
        $set: {
          compatibility: {
            category: 'CPU',
            extractorVersion: 'bad-version',
            facts: [],
            extractedAt: '',
            extractionIssues: [],
          },
        },
      });

      const result = await repo.persistFacts(id, makeFactSet({ extractorVersion: 'cpu/v2.0.0' }));
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.reason).toBe('stored_version_invalid');
      }

      // Stored version unchanged
      const doc = await CatalogProductModel.findById(id);
      expect(doc?.compatibility?.extractorVersion).toBe('bad-version');
    });

    it('does not modify rawSpecifications', async () => {
      const ids = await seedProducts(1);
      const id = ids[0]!;
      const docBefore = await CatalogProductModel.findById(id);
      const rawSpecsBefore = docBefore?.rawSpecifications.map((s) => ({
        label: s.label,
        value: s.value,
      }));

      await repo.persistFacts(id, makeFactSet());

      const docAfter = await CatalogProductModel.findById(id);
      const rawSpecsAfter = docAfter?.rawSpecifications.map((s) => ({
        label: s.label,
        value: s.value,
      }));
      expect(rawSpecsAfter).toEqual(rawSpecsBefore);
    });

    it('preserves existing rawSpecifications through fact write', async () => {
      const doc = await CatalogProductModel.create({
        ...makeProduct(),
        rawSpecifications: [
          { label: 'Socket', value: 'Socket AM5' },
          { label: 'Cores', value: '8' },
        ],
      });

      await repo.persistFacts(String(doc._id), makeFactSet());

      const after = await CatalogProductModel.findById(doc._id);
      expect(after?.rawSpecifications).toHaveLength(2);
      expect(after?.rawSpecifications[0]?.label).toBe('Socket');
      expect(after?.rawSpecifications[1]?.label).toBe('Cores');
    });
  });

  // -------------------------------------------------------------------------
  // Legacy normalization
  // -------------------------------------------------------------------------

  describe('findLegacyCompatibility', () => {
    it('finds documents with empty extractorVersion', async () => {
      await CatalogProductModel.create(
        makeProduct({ compatibility: { category: '', extractorVersion: '', facts: [], extractedAt: '', extractionIssues: [] } }),
      );

      const legacy = await repo.findLegacyCompatibility(10);
      expect(legacy).toHaveLength(1);
    });

    it('excludes null compatibility', async () => {
      await seedProducts(1);

      const legacy = await repo.findLegacyCompatibility(10);
      expect(legacy).toHaveLength(0);
    });

    it('excludes properly extracted documents', async () => {
      await CatalogProductModel.create(
        makeProduct({ compatibility: makeFactSet() }),
      );

      const legacy = await repo.findLegacyCompatibility(10);
      expect(legacy).toHaveLength(0);
    });
  });

  describe('normalizeLegacyCompatibility', () => {
    it('normalizes legacy documents to null', async () => {
      await CatalogProductModel.create(
        makeProduct({ compatibility: { category: '', extractorVersion: '', facts: [], extractedAt: '', extractionIssues: [] } }),
      );
      await CatalogProductModel.create(
        makeProduct({ compatibility: { category: '', extractorVersion: '', facts: [], extractedAt: '', extractionIssues: [] } }),
      );

      const count = await repo.normalizeLegacyCompatibility();
      expect(count).toBe(2);

      const remaining = await repo.countLegacyCompatibility();
      expect(remaining).toBe(0);

      // Verify they're null now
      const products = await CatalogProductModel.find();
      for (const p of products) {
        expect(p.compatibility).toBeNull();
      }
    });

    it('does not touch properly extracted documents', async () => {
      await CatalogProductModel.create(makeProduct({ compatibility: makeFactSet() }));
      await CatalogProductModel.create(makeProduct({ compatibility: null }));

      const count = await repo.normalizeLegacyCompatibility();
      expect(count).toBe(0);
    });

    it('processes in batches', async () => {
      // Create 5 legacy documents
      for (let i = 0; i < 5; i++) {
        await CatalogProductModel.create(
          makeProduct({ compatibility: { category: '', extractorVersion: '', facts: [], extractedAt: '', extractionIssues: [] } }),
        );
      }

      const count = await repo.normalizeLegacyCompatibility(2);
      expect(count).toBe(5);
    });
  });

  describe('countLegacyCompatibility', () => {
    it('counts legacy documents', async () => {
      await CatalogProductModel.create(
        makeProduct({ compatibility: { category: '', extractorVersion: '', facts: [], extractedAt: '', extractionIssues: [] } }),
      );
      await CatalogProductModel.create(
        makeProduct({ compatibility: { category: '', extractorVersion: '', facts: [], extractedAt: '', extractionIssues: [] } }),
      );
      await CatalogProductModel.create(makeProduct({ compatibility: makeFactSet() }));

      const count = await repo.countLegacyCompatibility();
      expect(count).toBe(2);
    });

    it('returns 0 when no legacy documents exist', async () => {
      await seedProducts(3);
      const count = await repo.countLegacyCompatibility();
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Count helpers
  // -------------------------------------------------------------------------

  describe('countByCategory', () => {
    it('counts products in a category', async () => {
      await seedProducts(3, 'CPU');
      await seedProducts(2, 'GPU');

      expect(await repo.countByCategory('CPU')).toBe(3);
      expect(await repo.countByCategory('GPU')).toBe(2);
      expect(await repo.countByCategory('RAM')).toBe(0);
    });
  });

  describe('countExtracted', () => {
    it('counts products with extracted compatibility', async () => {
      await CatalogProductModel.create(makeProduct({ compatibility: makeFactSet() }));
      await CatalogProductModel.create(makeProduct({ compatibility: null }));
      await CatalogProductModel.create(
        makeProduct({ compatibility: { category: '', extractorVersion: '', facts: [], extractedAt: '', extractionIssues: [] } }),
      );

      expect(await repo.countExtracted('CPU')).toBe(1);
    });
  });

  describe('findById', () => {
    it('finds a product by _id', async () => {
      const ids = await seedProducts(1); const id = ids[0]!;
      const found = await repo.findById(id);
      expect(found).toBeDefined();
      expect(String(found?._id)).toBe(id);
    });

    it('returns null for non-existent id', async () => {
      const found = await repo.findById('000000000000000000000000');
      expect(found).toBeNull();
    });
  });
});
