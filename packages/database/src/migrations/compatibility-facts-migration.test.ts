import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import { CatalogProductModel } from '../models/catalog-product.js';
import { migrationDryRun, migrationRun, migrationVerify } from './compatibility-facts-migration.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides?: { compatibility?: unknown }) {
  return {
    title: `Product ${Math.random().toString(36).slice(2, 8)}`,
    category: 'CPU',
    rawSpecifications: [{ label: 'Socket', value: 'Socket AM5' }],
    compatibility: overrides?.compatibility ?? null,
    buildEligibility: 'ELIGIBLE' as const,
  };
}

const LEGACY_EMPTY = {
  category: '',
  extractorVersion: '',
  facts: [],
  extractedAt: '',
  extractionIssues: [],
};

const PROPER_FACT_SET = {
  category: 'CPU',
  extractorVersion: 'cpu/v1.0.0',
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
          extractorVersion: 'cpu/v1.0.0',
          extractionIssues: [],
        },
      ],
    },
  ],
  extractedAt: '2026-07-16T00:00:00.000Z',
  extractionIssues: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compatibility-facts-migration', () => {
  beforeAll(async () => {
    await connectInMemoryDatabase();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // -------------------------------------------------------------------------
  // Dry run
  // -------------------------------------------------------------------------

  describe('migrationDryRun', () => {
    it('reports zero legacy documents on clean database', async () => {
      const result = await migrationDryRun();
      expect(result.wouldNormalize).toBe(0);
      expect(result.sampleIds).toEqual([]);
    });

    it('counts legacy documents without modifying them', async () => {
      await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));
      await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));
      await CatalogProductModel.create(makeProduct({ compatibility: null }));

      const before = await CatalogProductModel.countDocuments();

      const result = await migrationDryRun();
      expect(result.wouldNormalize).toBe(2);
      expect(result.sampleIds).toHaveLength(2);

      // Verify nothing was modified
      const after = await CatalogProductModel.countDocuments();
      expect(after).toBe(before);
    });

    it('returns sample IDs up to the limit', async () => {
      for (let i = 0; i < 5; i++) {
        await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));
      }

      const result = await migrationDryRun(3);
      expect(result.wouldNormalize).toBe(5);
      expect(result.sampleIds).toHaveLength(3);
    });

    it('excludes properly extracted documents', async () => {
      await CatalogProductModel.create(makeProduct({ compatibility: PROPER_FACT_SET }));
      await CatalogProductModel.create(makeProduct({ compatibility: null }));

      const result = await migrationDryRun();
      expect(result.wouldNormalize).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Run
  // -------------------------------------------------------------------------

  describe('migrationRun', () => {
    it('normalizes legacy documents to null', async () => {
      await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));
      await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));

      const result = await migrationRun();
      expect(result.normalized).toBe(2);
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);

      // Verify documents are now null
      const products = await CatalogProductModel.find();
      for (const p of products) {
        expect(p.compatibility).toBeNull();
      }
    });

    it('does not touch null or properly extracted documents', async () => {
      await CatalogProductModel.create(makeProduct({ compatibility: null }));
      await CatalogProductModel.create(makeProduct({ compatibility: PROPER_FACT_SET }));

      const result = await migrationRun();
      expect(result.normalized).toBe(0);

      // Verify nothing changed
      const products = await CatalogProductModel.find();
      expect(products[0]?.compatibility).toBeNull();
      expect(products[1]?.compatibility?.extractorVersion).toBe('cpu/v1.0.0');
    });

    it('processes in configurable batches', async () => {
      for (let i = 0; i < 7; i++) {
        await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));
      }

      const result = await migrationRun(3);
      expect(result.normalized).toBe(7);
    });

    it('handles empty database', async () => {
      const result = await migrationRun();
      expect(result.normalized).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Verify
  // -------------------------------------------------------------------------

  describe('migrationVerify', () => {
    it('reports clean when no legacy documents remain', async () => {
      await CatalogProductModel.create(makeProduct({ compatibility: null }));
      await CatalogProductModel.create(makeProduct({ compatibility: PROPER_FACT_SET }));

      const result = await migrationVerify();
      expect(result.clean).toBe(true);
      expect(result.legacyRemaining).toBe(0);
    });

    it('reports remaining legacy documents', async () => {
      await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));
      await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));

      const result = await migrationVerify();
      expect(result.clean).toBe(false);
      expect(result.legacyRemaining).toBe(2);
    });

    it('reports clean after successful migration', async () => {
      await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));
      await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));

      await migrationRun();
      const result = await migrationVerify();
      expect(result.clean).toBe(true);
      expect(result.legacyRemaining).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Safety: rawSpecifications immutability
  // -------------------------------------------------------------------------

  describe('rawSpecifications safety', () => {
    it('does not mutate rawSpecifications during normalization', async () => {
      const rawSpecs = [{ label: 'Socket', value: 'Socket AM5' }];
      await CatalogProductModel.create({
        ...makeProduct(),
        rawSpecifications: rawSpecs,
        compatibility: LEGACY_EMPTY,
      });

      await migrationRun();

      const product = await CatalogProductModel.findOne();
      expect(product?.rawSpecifications).toHaveLength(1);
      expect(product?.rawSpecifications[0]?.label).toBe('Socket');
      expect(product?.rawSpecifications[0]?.value).toBe('Socket AM5');
    });

    it('rawSpecifications deep-equal unchanged after run', async () => {
      const rawSpecs = [
        { label: 'Socket', value: 'Socket AM5' },
        { label: 'Cores', value: '8' },
        { label: 'TDP', value: '170W' },
      ];
      const doc = await CatalogProductModel.create({
        ...makeProduct(),
        rawSpecifications: rawSpecs,
        compatibility: LEGACY_EMPTY,
      });

      // Capture the shape before migration (MongoDB adds _id to subdocs)
      const beforeDoc = await CatalogProductModel.findById(doc._id).lean();
      const beforeSpecs = JSON.parse(JSON.stringify(beforeDoc?.rawSpecifications));

      await migrationRun();

      const after = await CatalogProductModel.findById(doc._id).lean();
      const afterSpecs = JSON.parse(JSON.stringify(after?.rawSpecifications));

      // Same number of specs
      expect(afterSpecs).toHaveLength(beforeSpecs.length);
      // Same label/value pairs (ignore _id differences)
      for (let i = 0; i < afterSpecs.length; i++) {
        expect(afterSpecs[i]!.label).toBe(beforeSpecs[i]!.label);
        expect(afterSpecs[i]!.value).toBe(beforeSpecs[i]!.value);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Safety: dry-run does not write
  // -------------------------------------------------------------------------

  describe('dry-run does not write', () => {
    it('migrationDryRun does not modify any documents', async () => {
      await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));
      await CatalogProductModel.create(makeProduct({ compatibility: LEGACY_EMPTY }));

      // Capture state before
      const before = await CatalogProductModel.find().lean();
      const beforeIds = before.map((d) => String(d._id));
      const beforeCompat = before.map((d) => d.compatibility);

      await migrationDryRun();

      // Verify every document is identical
      const after = await CatalogProductModel.find().lean();
      expect(after).toHaveLength(before.length);
      for (let i = 0; i < after.length; i++) {
        expect(String(after[i]!._id)).toBe(beforeIds[i]);
        expect(JSON.stringify(after[i]!.compatibility)).toBe(
          JSON.stringify(beforeCompat[i]),
        );
      }
    });

    it('migrationDryRun count matches but data unchanged', async () => {
      const rawSpecs = [{ label: 'Socket', value: 'AM5' }];
      await CatalogProductModel.create({
        ...makeProduct(),
        rawSpecifications: rawSpecs,
        compatibility: LEGACY_EMPTY,
      });

      const result = await migrationDryRun();
      expect(result.wouldNormalize).toBe(1);

      // Verify legacy doc still exists with empty extractorVersion
      const doc = await CatalogProductModel.findOne();
      expect(doc?.compatibility).not.toBeNull();
      expect(doc?.compatibility?.extractorVersion).toBe('');
      expect(doc?.rawSpecifications).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Safety: no TTL
  // -------------------------------------------------------------------------

  describe('no TTL index', () => {
    it('category_quality_reports collection has no TTL index', async () => {
      const { CategoryQualityReportModel } = await import('../models/category-quality-report.js');
      await CategoryQualityReportModel.create({
        category: 'CPU',
        extractorVersion: 'cpu/v1.0.0',
        totalProducts: 100,
        factMetrics: [],
        allGatesPass: false,
        evaluatedAt: new Date(),
      });

      const indexes = await CategoryQualityReportModel.collection.indexes();
      const ttlIndex = indexes.find(
        (idx) => 'expireAfterSeconds' in idx && idx.expireAfterSeconds !== undefined,
      );
      expect(ttlIndex).toBeUndefined();
    });
  });
});
