import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import { ScrapeRunRepository } from './scrape-run-repository.js';
import { RawProductSnapshotRepository } from './raw-product-snapshot-repository.js';

describe('RawProductSnapshotRepository', () => {
  let runRepository: ScrapeRunRepository;
  let snapshotRepository: RawProductSnapshotRepository;
  let runId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    runRepository = new ScrapeRunRepository();
    snapshotRepository = new RawProductSnapshotRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    const run = await runRepository.create({ storeCode: 'SIGMA', runId: 'test-run-snapshots', mode: 'FULL' });
    runId = run._id;
  });

  const createTestSnapshot = (overrides = {}) => ({
    storeCode: 'SIGMA' as const,
    externalId: '9f503b67-b433-4434-8879-ebd003dce713',
    canonicalUrl: 'https://www.sigma-computer.com/en/item?id=test-product',
    sourceUrl: 'https://www.sigma-computer.com/en/item?id=test-product',
    scrapeRunId: runId,
    fetchedAt: new Date(),
    httpStatus: 200,
    responseContentType: 'text/html',
    contentSha256: 'abc123def456',
    contentStorage: 'FILE' as const,
    contentPath: '/path/to/file.html.gz',
    parserVersion: '0.1.0',
    parseStatus: 'OK' as const,
    raw: {
      title: 'Test Product',
      priceText: '1500',
      oldPriceText: null,
      availabilityText: 'true',
      skuText: 'SKU-123',
      brandText: 'TestBrand',
      modelText: null,
      partNumberText: null,
      breadcrumbs: ['Home', 'CPU'],
      specifications: [{ label: 'Capacity', value: '16GB' }],
      imageUrls: ['https://example.com/img1.jpg'],
      descriptionText: 'Test description',
    },
    parseWarnings: [],
    ...overrides,
  });

  it('inserts a snapshot', async () => {
    const snapshot = await snapshotRepository.insert(createTestSnapshot());

    expect(snapshot).toBeDefined();
    expect(snapshot.externalId).toBe('9f503b67-b433-4434-8879-ebd003dce713');
    expect(snapshot.parseStatus).toBe('OK');
    expect(snapshot.raw.title).toBe('Test Product');
  });

  it('finds snapshots by runId', async () => {
    await snapshotRepository.insert(createTestSnapshot());
    await snapshotRepository.insert(
      createTestSnapshot({
        canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-2',
        contentSha256: 'different-hash',
      }),
    );

    const snapshots = await snapshotRepository.findByRunId(runId);
    expect(snapshots).toHaveLength(2);
  });

  it('finds snapshots by canonicalUrl', async () => {
    await snapshotRepository.insert(createTestSnapshot());
    await snapshotRepository.insert(
      createTestSnapshot({
        contentSha256: 'hash-v2',
        fetchedAt: new Date(Date.now() + 1000),
      }),
    );

    const snapshots = await snapshotRepository.findByCanonicalUrl(
      'https://www.sigma-computer.com/en/item?id=test-product',
    );
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?.contentSha256).toBe('hash-v2');
  });

  it('counts snapshots by parseStatus', async () => {
    await snapshotRepository.insert(createTestSnapshot({ parseStatus: 'OK' }));
    await snapshotRepository.insert(
      createTestSnapshot({
        contentSha256: 'failed-hash',
        parseStatus: 'FAILED',
        raw: {
          title: null,
          priceText: null,
          oldPriceText: null,
          availabilityText: null,
          skuText: null,
          brandText: null,
          modelText: null,
          partNumberText: null,
          breadcrumbs: [],
          specifications: [],
          imageUrls: [],
          descriptionText: null,
        },
        parseWarnings: ['PARSE_FAILED'],
      }),
    );

    const counts = await snapshotRepository.countByParseStatus(runId);
    expect(counts.ok).toBe(1);
    expect(counts.failed).toBe(1);
  });

  it('skips duplicate content in same run', async () => {
    const sha256 = 'duplicate-hash';
    await snapshotRepository.insert(createTestSnapshot({ contentSha256: sha256 }));
    const duplicate = await snapshotRepository.findByContentSha256(sha256, runId);

    expect(duplicate).toBeDefined();
    expect(duplicate?.contentSha256).toBe(sha256);
    expect(duplicate).not.toBeNull();
  });

  it('counts missing prices by run id', async () => {
    // OK snapshot with price
    await snapshotRepository.insert(createTestSnapshot({
      parseStatus: 'OK',
      raw: {
        title: 'Product 1',
        priceText: '1500',
        oldPriceText: null,
        availabilityText: 'true',
        skuText: 'SKU-1',
        brandText: 'Brand',
        modelText: null,
        partNumberText: null,
        breadcrumbs: [],
        specifications: [],
        imageUrls: [],
        descriptionText: null,
      },
    }));

    // OK snapshot with null price
    await snapshotRepository.insert(createTestSnapshot({
      contentSha256: 'hash-null-price',
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-2',
      parseStatus: 'OK',
      raw: {
        title: 'Product 2',
        priceText: null,
        oldPriceText: null,
        availabilityText: 'true',
        skuText: 'SKU-2',
        brandText: 'Brand',
        modelText: null,
        partNumberText: null,
        breadcrumbs: [],
        specifications: [],
        imageUrls: [],
        descriptionText: null,
      },
    }));

    // OK snapshot with empty string price
    await snapshotRepository.insert(createTestSnapshot({
      contentSha256: 'hash-empty-price',
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-3',
      parseStatus: 'OK',
      raw: {
        title: 'Product 3',
        priceText: '',
        oldPriceText: null,
        availabilityText: 'true',
        skuText: 'SKU-3',
        brandText: 'Brand',
        modelText: null,
        partNumberText: null,
        breadcrumbs: [],
        specifications: [],
        imageUrls: [],
        descriptionText: null,
      },
    }));

    // OK snapshot with whitespace-only price
    await snapshotRepository.insert(createTestSnapshot({
      contentSha256: 'hash-whitespace-price',
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-4',
      parseStatus: 'OK',
      raw: {
        title: 'Product 4',
        priceText: '  ',
        oldPriceText: null,
        availabilityText: 'true',
        skuText: 'SKU-4',
        brandText: 'Brand',
        modelText: null,
        partNumberText: null,
        breadcrumbs: [],
        specifications: [],
        imageUrls: [],
        descriptionText: null,
      },
    }));

    // FAILED snapshot (should not be counted)
    await snapshotRepository.insert(createTestSnapshot({
      contentSha256: 'hash-failed',
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=product-5',
      parseStatus: 'FAILED',
      raw: {
        title: null,
        priceText: null,
        oldPriceText: null,
        availabilityText: null,
        skuText: null,
        brandText: null,
        modelText: null,
        partNumberText: null,
        breadcrumbs: [],
        specifications: [],
        imageUrls: [],
        descriptionText: null,
      },
    }));

    const counts = await snapshotRepository.countMissingPricesByRunId(runId);
    // 4 OK snapshots, 3 missing (null, empty, whitespace)
    expect(counts.total).toBe(4);
    expect(counts.missing).toBe(3);
  });

  it('returns zero counts when no snapshots exist', async () => {
    const counts = await snapshotRepository.countMissingPricesByRunId(runId);
    expect(counts.total).toBe(0);
    expect(counts.missing).toBe(0);
  });
});
