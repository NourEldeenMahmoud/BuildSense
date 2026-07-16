import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import { CatalogProductModel } from './catalog-product.js';
import { CategoryQualityReportModel } from './category-quality-report.js';
import { ReferenceDatasetModel } from './reference-dataset.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFactSet(overrides?: { category?: string; facts?: unknown[] }) {
  return {
    category: overrides?.category ?? 'CPU',
    extractorVersion: '0.1.0',
    extractedAt: '2026-07-16T00:00:00.000Z',
    extractionIssues: [],
    facts: overrides?.facts ?? [
      {
        key: 'cpu.socket',
        value: 'AM5',
        evidence: [
          {
            sourceLabel: 'Socket',
            rawValue: 'Socket AM5',
            normalizedValue: 'AM5',
            confidence: 0.95,
            extractorVersion: '0.1.0',
            extractionIssues: [],
          },
        ],
      },
    ],
  };
}

function makeMinimalProduct(overrides?: { compatibility?: unknown }) {
  return {
    title: 'Test Product',
    category: 'CPU',
    rawSpecifications: [{ label: 'Socket', value: 'Socket AM5' }],
    compatibility: overrides?.compatibility ?? null,
    buildEligibility: 'ELIGIBLE' as const,
  };
}

// ---------------------------------------------------------------------------
// P0-7: CatalogProduct.compatibility structured subdocument
// ---------------------------------------------------------------------------

describe('CatalogProduct.compatibility (P0-7)', () => {
  beforeAll(async () => {
    await connectInMemoryDatabase();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('defaults compatibility to null for new documents', async () => {
    const doc = await CatalogProductModel.create(makeMinimalProduct());
    expect(doc.compatibility).toBeNull();
  });

  it('persists and round-trips a full CompatibilityFactSet', async () => {
    const factSet = makeFactSet();
    const doc = await CatalogProductModel.create(
      makeMinimalProduct({ compatibility: factSet }),
    );

    expect(doc.compatibility).not.toBeNull();
    expect(doc.compatibility!.category).toBe('CPU');
    expect(doc.compatibility!.extractorVersion).toBe('0.1.0');
    expect(doc.compatibility!.facts).toHaveLength(1);

    const fact = doc.compatibility!.facts[0]!;
    expect(fact.key).toBe('cpu.socket');
    expect(fact.value).toBe('AM5');
    expect(fact.evidence).toHaveLength(1);
    expect(fact.evidence[0]!.sourceLabel).toBe('Socket');
    expect(fact.evidence[0]!.rawValue).toBe('Socket AM5');
    expect(fact.evidence[0]!.normalizedValue).toBe('AM5');
    expect(fact.evidence[0]!.confidence).toBe(0.95);
    expect(fact.evidence[0]!.extractorVersion).toBe('0.1.0');
    expect(fact.evidence[0]!.extractionIssues).toEqual([]);
  });

  it('round-trips facts with null value (explicit absence)', async () => {
    const factSet = makeFactSet({
      facts: [
        {
          key: 'cpu.tdp',
          value: null,
          evidence: [
            {
              sourceLabel: 'TDP',
              rawValue: '',
              normalizedValue: null,
              confidence: 0.3,
              extractorVersion: '0.1.0',
              extractionIssues: ['empty value'],
            },
          ],
        },
      ],
    });

    const doc = await CatalogProductModel.create(
      makeMinimalProduct({ compatibility: factSet }),
    );

    const fact = doc.compatibility!.facts[0]!;
    expect(fact.key).toBe('cpu.tdp');
    expect(fact.value).toBeNull();
    expect(fact.evidence[0]!.confidence).toBe(0.3);
    expect(fact.evidence[0]!.extractionIssues).toEqual(['empty value']);
  });

  it('preserves empty rawValue without substituting a placeholder', async () => {
    const factSet = makeFactSet({
      facts: [
        {
          key: 'cpu.socket',
          value: 'AM5',
          evidence: [
            {
              sourceLabel: 'Socket',
              rawValue: '',
              normalizedValue: 'AM5',
              confidence: 0.9,
              extractorVersion: '0.1.0',
              extractionIssues: ['empty source label'],
            },
          ],
        },
      ],
    });

    const doc = await CatalogProductModel.create(
      makeMinimalProduct({ compatibility: factSet }),
    );

    const evidence = doc.compatibility!.facts[0]!.evidence[0]!;
    expect(evidence.rawValue).toBe('');
    expect(evidence.normalizedValue).toBe('AM5');
    expect(evidence.extractionIssues).toEqual(['empty source label']);
  });

  it('round-trips extractionIssues at fact-set level', async () => {
    const factSet = makeFactSet();
    const withIssues = { ...factSet, extractionIssues: ['no specifications found'] };
    const doc = await CatalogProductModel.create(
      makeMinimalProduct({ compatibility: withIssues }),
    );

    expect(doc.compatibility!.extractionIssues).toEqual(['no specifications found']);
  });

  it('handles multiple facts with different evidence', async () => {
    const factSet = makeFactSet({
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
              extractorVersion: '0.1.0',
              extractionIssues: [],
            },
          ],
        },
        {
          key: 'cpu.tdp',
          value: 170,
          evidence: [
            {
              sourceLabel: 'TDP',
              rawValue: '170W',
              normalizedValue: null,
              confidence: 0.8,
              extractorVersion: '0.1.0',
              extractionIssues: ['unit stripped'],
            },
          ],
        },
      ],
    });

    const doc = await CatalogProductModel.create(
      makeMinimalProduct({ compatibility: factSet }),
    );

    expect(doc.compatibility!.facts).toHaveLength(2);
    expect(doc.compatibility!.facts[0]!.key).toBe('cpu.socket');
    expect(doc.compatibility!.facts[1]!.key).toBe('cpu.tdp');
    expect(doc.compatibility!.facts[1]!.value).toBe(170);
  });

  it('reads legacy empty-object compatibility without crashing', async () => {
    // Simulate an old document that has compatibility: {}
    // Mongoose casts {} through the schema; required fields get defaults.
    // Phase 2 migration will normalize these to null or proper fact sets.
    const doc = await CatalogProductModel.create({
      ...makeMinimalProduct(),
      compatibility: {},
    });

    expect(doc.compatibility).not.toBeNull();
    expect(doc.compatibility!.category).toBe('');
    expect(doc.compatibility!.extractorVersion).toBe('');
    expect(doc.compatibility!.facts).toEqual([]);
    expect(doc.compatibility!.extractedAt).toBe('');
  });

  it('enforces confidence range 0..1 at schema boundary', async () => {
    const factSet = makeFactSet({
      facts: [
        {
          key: 'cpu.socket',
          value: 'AM5',
          evidence: [
            {
              sourceLabel: 'Socket',
              rawValue: 'Socket AM5',
              normalizedValue: 'AM5',
              confidence: 1.5, // out of range
              extractorVersion: '0.1.0',
              extractionIssues: [],
            },
          ],
        },
      ],
    });

    await expect(
      CatalogProductModel.create(makeMinimalProduct({ compatibility: factSet })),
    ).rejects.toThrow();
  });

  it('does not mutate rawSpecifications', async () => {
    const rawSpecs = [{ label: 'Socket', value: 'Socket AM5' }];
    const doc = await CatalogProductModel.create({
      ...makeMinimalProduct(),
      rawSpecifications: rawSpecs,
      compatibility: makeFactSet(),
    });

    // Mongoose subdocument arrays gain _id; verify content is preserved
    expect(doc.rawSpecifications).toHaveLength(1);
    expect(doc.rawSpecifications[0]!.label).toBe('Socket');
    expect(doc.rawSpecifications[0]!.value).toBe('Socket AM5');
    // Original input not mutated
    expect(rawSpecs[0]!).not.toHaveProperty('_id');
  });
});

// ---------------------------------------------------------------------------
// P0-9: CategoryQualityReport model
// ---------------------------------------------------------------------------

describe('CategoryQualityReport (P0-9)', () => {
  beforeAll(async () => {
    await connectInMemoryDatabase();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('creates a report with fact metrics', async () => {
    const report = await CategoryQualityReportModel.create({
      category: 'CPU',
      extractorVersion: '0.1.0',
      totalProducts: 100,
      factMetrics: [
        {
          factKey: 'cpu.socket',
          extractableCount: 95,
          coverage: 0.95,
          verifiedCorrect: 90,
          verifiedSampleSize: 95,
          precision: 0.947,
        },
        {
          factKey: 'cpu.tdp',
          extractableCount: 80,
          coverage: 0.8,
          verifiedCorrect: null,
          verifiedSampleSize: null,
          precision: null,
        },
      ],
      allGatesPass: false,
      evaluatedAt: new Date('2026-07-16T00:00:00Z'),
    });

    expect(report.category).toBe('CPU');
    expect(report.extractorVersion).toBe('0.1.0');
    expect(report.totalProducts).toBe(100);
    expect(report.factMetrics).toHaveLength(2);
    expect(report.factMetrics[0]!.factKey).toBe('cpu.socket');
    expect(report.factMetrics[0]!.coverage).toBe(0.95);
    expect(report.factMetrics[1]!.precision).toBeNull();
    expect(report.allGatesPass).toBe(false);
  });

  it('enforces unique (category, extractorVersion)', async () => {
    await CategoryQualityReportModel.create({
      category: 'CPU',
      extractorVersion: '0.1.0',
      totalProducts: 100,
      factMetrics: [],
      allGatesPass: false,
      evaluatedAt: new Date(),
    });

    await expect(
      CategoryQualityReportModel.create({
        category: 'CPU',
        extractorVersion: '0.1.0',
        totalProducts: 100,
        factMetrics: [],
        allGatesPass: false,
        evaluatedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it('allows different extractor versions for the same category', async () => {
    await CategoryQualityReportModel.create({
      category: 'CPU',
      extractorVersion: '0.1.0',
      totalProducts: 100,
      factMetrics: [],
      allGatesPass: false,
      evaluatedAt: new Date(),
    });

    const second = await CategoryQualityReportModel.create({
      category: 'CPU',
      extractorVersion: '0.2.0',
      totalProducts: 100,
      factMetrics: [],
      allGatesPass: false,
      evaluatedAt: new Date(),
    });

    expect(second.extractorVersion).toBe('0.2.0');
  });

  it('allows different categories for the same extractor version', async () => {
    await CategoryQualityReportModel.create({
      category: 'CPU',
      extractorVersion: '0.1.0',
      totalProducts: 100,
      factMetrics: [],
      allGatesPass: false,
      evaluatedAt: new Date(),
    });

    const second = await CategoryQualityReportModel.create({
      category: 'Motherboard',
      extractorVersion: '0.1.0',
      totalProducts: 80,
      factMetrics: [],
      allGatesPass: false,
      evaluatedAt: new Date(),
    });

    expect(second.category).toBe('Motherboard');
  });

  it('validates coverage range 0..1', async () => {
    await expect(
      CategoryQualityReportModel.create({
        category: 'CPU',
        extractorVersion: '0.1.0',
        totalProducts: 100,
        factMetrics: [
          {
            factKey: 'cpu.socket',
            extractableCount: 95,
            coverage: 1.5, // out of range
            verifiedCorrect: null,
            verifiedSampleSize: null,
            precision: null,
          },
        ],
        allGatesPass: false,
        evaluatedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it('validates min 0 on extractableCount', async () => {
    await expect(
      CategoryQualityReportModel.create({
        category: 'CPU',
        extractorVersion: '0.1.0',
        totalProducts: 100,
        factMetrics: [
          {
            factKey: 'cpu.socket',
            extractableCount: -1, // invalid
            coverage: 0.95,
            verifiedCorrect: null,
            verifiedSampleSize: null,
            precision: null,
          },
        ],
        allGatesPass: false,
        evaluatedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it('separates quality reports from product facts', async () => {
    // Create a product with compatibility facts
    await CatalogProductModel.create(
      makeMinimalProduct({ compatibility: makeFactSet() }),
    );

    // Create a quality report — separate collection
    await CategoryQualityReportModel.create({
      category: 'CPU',
      extractorVersion: '0.1.0',
      totalProducts: 1,
      factMetrics: [],
      allGatesPass: true,
      evaluatedAt: new Date(),
    });

    const products = await CatalogProductModel.find();
    const reports = await CategoryQualityReportModel.find();

    expect(products).toHaveLength(1);
    expect(reports).toHaveLength(1);
    // Quality reports are NOT embedded in products
    const productObj = products[0]!.toJSON() as Record<string, unknown>;
    expect(productObj).not.toHaveProperty('factMetrics');
  });

  it('defaults allGatesPass to false', async () => {
    const report = await CategoryQualityReportModel.create({
      category: 'GPU',
      extractorVersion: '0.1.0',
      totalProducts: 50,
      factMetrics: [],
      evaluatedAt: new Date(),
    });

    expect(report.allGatesPass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P0-10: ReferenceDataset model
// ---------------------------------------------------------------------------

describe('ReferenceDataset (P0-10)', () => {
  beforeAll(async () => {
    await connectInMemoryDatabase();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('creates a dataset with empty chipsetCpuSupport', async () => {
    const ds = await ReferenceDatasetModel.create({
      version: '1.0.0',
      publishedAt: new Date('2026-07-16T00:00:00Z'),
      chipsetCpuSupport: [],
      citation: 'Test source',
    });

    expect(ds.version).toBe('1.0.0');
    expect(ds.chipsetCpuSupport).toEqual([]);
    expect(ds.citation).toBe('Test source');
  });

  it('creates a dataset with chipset entries', async () => {
    const ds = await ReferenceDatasetModel.create({
      version: '1.0.0',
      publishedAt: new Date('2026-07-16T00:00:00Z'),
      chipsetCpuSupport: [
        {
          chipset: 'B650',
          supportedFamilies: ['Ryzen 7000', 'Ryzen 9000'],
          biosUpdateRequired: ['Ryzen 9000'],
          source: 'https://example.com/b650',
          verifiedAt: new Date('2026-07-16T00:00:00Z'),
        },
      ],
      citation: 'Test source',
    });

    expect(ds.chipsetCpuSupport).toHaveLength(1);
    expect(ds.chipsetCpuSupport[0]!.chipset).toBe('B650');
    expect(ds.chipsetCpuSupport[0]!.supportedFamilies).toEqual(['Ryzen 7000', 'Ryzen 9000']);
    expect(ds.chipsetCpuSupport[0]!.biosUpdateRequired).toEqual(['Ryzen 9000']);
  });

  it('enforces unique version', async () => {
    await ReferenceDatasetModel.create({
      version: '1.0.0',
      publishedAt: new Date(),
      chipsetCpuSupport: [],
      citation: 'Source 1',
    });

    await expect(
      ReferenceDatasetModel.create({
        version: '1.0.0',
        publishedAt: new Date(),
        chipsetCpuSupport: [],
        citation: 'Source 2',
      }),
    ).rejects.toThrow();
  });

  it('allows multiple versions', async () => {
    await ReferenceDatasetModel.create({
      version: '1.0.0',
      publishedAt: new Date(),
      chipsetCpuSupport: [],
      citation: 'Source 1',
    });

    const v2 = await ReferenceDatasetModel.create({
      version: '2.0.0',
      publishedAt: new Date(),
      chipsetCpuSupport: [],
      citation: 'Source 2',
    });

    expect(v2.version).toBe('2.0.0');
  });

  it('defaults chipsetCpuSupport to empty array (no fabricated data)', async () => {
    const ds = await ReferenceDatasetModel.create({
      version: '1.0.0',
      publishedAt: new Date(),
      citation: 'Test',
    });

    expect(ds.chipsetCpuSupport).toEqual([]);
  });

  it('persists source and change-control metadata per entry', async () => {
    const now = new Date('2026-07-16T00:00:00Z');
    const ds = await ReferenceDatasetModel.create({
      version: '1.0.0',
      publishedAt: now,
      chipsetCpuSupport: [
        {
          chipset: 'Z790',
          supportedFamilies: ['Ryzen 7000'],
          biosUpdateRequired: [],
          source: 'https://amd.com/chipsets',
          verifiedAt: now,
        },
      ],
      citation: 'AMD chipset documentation',
    });

    const entry = ds.chipsetCpuSupport[0]!;
    expect(entry.source).toBe('https://amd.com/chipsets');
    expect(entry.verifiedAt).toEqual(now);
  });

  it('is a separate collection from products and quality reports', async () => {
    await CatalogProductModel.create(makeMinimalProduct());
    await CategoryQualityReportModel.create({
      category: 'CPU',
      extractorVersion: '0.1.0',
      totalProducts: 1,
      factMetrics: [],
      allGatesPass: false,
      evaluatedAt: new Date(),
    });
    await ReferenceDatasetModel.create({
      version: '1.0.0',
      publishedAt: new Date(),
      chipsetCpuSupport: [],
      citation: 'Test',
    });

    const products = await CatalogProductModel.find();
    const reports = await CategoryQualityReportModel.find();
    const datasets = await ReferenceDatasetModel.find();

    expect(products).toHaveLength(1);
    expect(reports).toHaveLength(1);
    expect(datasets).toHaveLength(1);
  });

  it('round-trips date fields correctly', async () => {
    const now = new Date('2026-07-16T12:30:00.000Z');
    const ds = await ReferenceDatasetModel.create({
      version: '1.0.0',
      publishedAt: now,
      chipsetCpuSupport: [
        {
          chipset: 'B650',
          supportedFamilies: [],
          biosUpdateRequired: [],
          source: 'test',
          verifiedAt: now,
        },
      ],
      citation: 'Test',
    });

    expect(ds.publishedAt).toEqual(now);
    expect(ds.chipsetCpuSupport[0]!.verifiedAt).toEqual(now);
  });
});
