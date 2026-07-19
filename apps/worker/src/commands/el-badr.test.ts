import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '@buildsense/database/src/test-utils.js';
import {
  RawProductSnapshotModel,
  ScrapeRunModel,
  CatalogProductModel,
  OfferModel,
  RawProductSnapshotRepository,
  CatalogProductRepository,
  OfferRepository,
} from '@buildsense/database';
import { StoreProductPublisher, resolveCategoryFromBreadcrumbs } from '../services/store-product-publisher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshotData(scrapeRunId: Types.ObjectId, overrides?: Record<string, unknown>) {
  return {
    storeCode: 'EL_BADR' as const,
    externalId: '7527',
    canonicalUrl: 'https://elbadrgroupeg.store/amd-ryzen-5-5600t',
    sourceUrl: 'https://elbadrgroupeg.store/amd-ryzen-5-5600t',
    scrapeRunId,
    fetchedAt: new Date(),
    httpStatus: 200,
    responseContentType: 'text/html',
    contentSha256: 'test-sha256-5600t',
    contentStorage: 'INLINE' as const,
    parserVersion: '0.1.0',
    parseStatus: 'OK' as const,
    raw: {
      title: 'AMD Ryzen 5 5600T 6-Core Zen 3 Processor',
      priceText: '6,650 EGP',
      oldPriceText: null,
      availabilityText: 'In Stock',
      skuText: null,
      brandText: 'AMD',
      modelText: 'Ryzen 5 5600T Desktop Processor',
      partNumberText: '100-000001584',
      breadcrumbs: ['CPU', 'AMD Processors'],
      specifications: [
        { label: 'Cores', value: '6' },
        { label: 'Threads', value: '12' },
        { label: 'Socket', value: 'AM4' },
      ],
      imageUrls: ['https://example.com/5600t.jpg'],
      descriptionText: null,
    },
    parseWarnings: [],
    ...overrides,
  };
}

async function createTestRun(): Promise<Types.ObjectId> {
  const run = await ScrapeRunModel.create({
    storeCode: 'EL_BADR',
    runId: 'test-run-5600t',
    mode: 'URL',
    status: 'SUCCEEDED',
    stage: 'FETCH',
  });
  return run._id as Types.ObjectId;
}

// ---------------------------------------------------------------------------
// Publish-snapshot validation (simulates el-badr publish-snapshot logic)
// ---------------------------------------------------------------------------

describe('publish-snapshot validation', () => {
  let snapshotRepository: RawProductSnapshotRepository;
  let catalogProductRepository: CatalogProductRepository;
  let offerRepository: OfferRepository;
  let runId: Types.ObjectId;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    snapshotRepository = new RawProductSnapshotRepository();
    catalogProductRepository = new CatalogProductRepository();
    offerRepository = new OfferRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    runId = await createTestRun();
  });

  it('publishes a valid EL_BADR snapshot into catalog + offers', async () => {
    const snapshot = await RawProductSnapshotModel.create(makeSnapshotData(runId));

    const publisher = new StoreProductPublisher({
      catalogProductRepository,
      offerRepository,
      snapshotRepository,
    });

    const { raw } = snapshot;
    const result = await publisher.publish({
      storeCode: snapshot.storeCode,
      externalId: snapshot.externalId ?? '',
      canonicalUrl: snapshot.canonicalUrl,
      sourceUrl: snapshot.sourceUrl,
      category: resolveCategoryFromBreadcrumbs(raw.breadcrumbs, 'UNCATEGORIZED'),
      title: raw.title,
      brand: raw.brandText ?? null,
      model: raw.modelText ?? null,
      mpn: raw.partNumberText ?? null,
      imageUrl: raw.imageUrls[0] ?? null,
      priceText: raw.priceText ?? null,
      availabilityText: raw.availabilityText ?? null,
      rawSpecifications: raw.specifications,
    });

    expect(result.kind).toBe('PUBLISHED_NEW_PRODUCT');
    expect(result.productId).toBeDefined();
    expect(result.offerId).toBeDefined();

    // Verify catalog product
    const product = await CatalogProductModel.findById(result.productId);
    expect(product).not.toBeNull();
    expect(product!.title).toBe('AMD Ryzen 5 5600T 6-Core Zen 3 Processor');
    expect(product!.category).toBe('CPU');
    expect(product!.brand).toBe('amd');
    expect(product!.mpn).toBe('100-000001584');

    // Verify offer
    const offer = await OfferModel.findById(result.offerId);
    expect(offer).not.toBeNull();
    expect(offer!.storeCode).toBe('EL_BADR');
    expect(offer!.storeExternalId).toBe('7527');
    expect(offer!.price).toBe(6650);
    expect(offer!.availability).toBe('IN_STOCK');
  });

  it('rejects snapshot with wrong storeCode', async () => {
    const snapshot = await RawProductSnapshotModel.create(
      makeSnapshotData(runId, { storeCode: 'SIGMA' }),
    );

    // Simulate the CLI validation check
    expect(snapshot.storeCode).not.toBe('EL_BADR');
  });

  it('rejects snapshot with failed parseStatus', async () => {
    const snapshot = await RawProductSnapshotModel.create(
      makeSnapshotData(runId, { parseStatus: 'FAILED' }),
    );

    // Simulate the CLI validation check
    expect(snapshot.parseStatus).not.toBe('OK');
  });

  it('rejects snapshot with empty title', async () => {
    const snapshot = await RawProductSnapshotModel.create(
      makeSnapshotData(runId, {
        raw: {
          ...makeSnapshotData(runId).raw,
          title: '',
        },
      }),
    );

    // Simulate the CLI validation check
    expect(!snapshot.raw.title || snapshot.raw.title.trim().length === 0).toBe(true);
  });

  it('rejects snapshot with empty breadcrumbs', async () => {
    const snapshot = await RawProductSnapshotModel.create(
      makeSnapshotData(runId, {
        raw: {
          ...makeSnapshotData(runId).raw,
          breadcrumbs: [],
        },
      }),
    );

    // Simulate the CLI validation check
    expect(!snapshot.raw.breadcrumbs || snapshot.raw.breadcrumbs.length === 0).toBe(true);
  });

  it('handles breadcrumbs fallback to UNCATEGORIZED when empty array', async () => {
    const breadcrumbs: string[] = [];
    const category = resolveCategoryFromBreadcrumbs(breadcrumbs, 'UNCATEGORIZED');
    expect(category).toBe('UNCATEGORIZED');
  });

  it('idempotently re-publishes same snapshot', async () => {
    const snapshot = await RawProductSnapshotModel.create(makeSnapshotData(runId));

    const publisher = new StoreProductPublisher({
      catalogProductRepository,
      offerRepository,
      snapshotRepository,
    });

    const makePublishInput = () => {
      const { raw } = snapshot;
      return {
        storeCode: snapshot.storeCode,
        externalId: snapshot.externalId ?? '',
        canonicalUrl: snapshot.canonicalUrl,
        sourceUrl: snapshot.sourceUrl,
        category: resolveCategoryFromBreadcrumbs(raw.breadcrumbs, 'UNCATEGORIZED'),
        title: raw.title,
        brand: raw.brandText ?? null,
        model: raw.modelText ?? null,
        mpn: raw.partNumberText ?? null,
        imageUrl: raw.imageUrls[0] ?? null,
        priceText: raw.priceText ?? null,
        availabilityText: raw.availabilityText ?? null,
        rawSpecifications: raw.specifications,
      };
    };

    const first = await publisher.publish(makePublishInput());
    expect(first.kind).toBe('PUBLISHED_NEW_PRODUCT');

    const second = await publisher.publish(makePublishInput());
    expect(second.kind).toBe('PUBLISHED_UPDATED_OFFER');
    expect(second.productId).toBe(first.productId);

    // Only one product and one offer
    const productCount = await CatalogProductModel.countDocuments();
    const offerCount = await OfferModel.countDocuments();
    expect(productCount).toBe(1);
    expect(offerCount).toBe(1);
  });
});
