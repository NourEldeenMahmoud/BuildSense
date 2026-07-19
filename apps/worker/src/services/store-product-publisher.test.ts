import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '@buildsense/database/src/test-utils.js';
import { CatalogProductModel, OfferModel, CatalogProductRepository, OfferRepository, RawProductSnapshotRepository } from '@buildsense/database';
import {
  StoreProductPublisher,
  checkEligibility,
  parseFixedPrice,
  extractCoreModelToken,
  extractModelShortToken,
  normalizeBrand,
  checkDuplicateGuard,
  resolveCategoryFromBreadcrumbs,
  type PublisherInput,
} from './store-product-publisher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides?: Partial<PublisherInput>): PublisherInput {
  return {
    storeCode: 'EL_BADR',
    externalId: '7527',
    canonicalUrl: 'https://elbadrgroupeg.store/amd-ryzen-5-5600t',
    sourceUrl: 'https://elbadrgroupeg.store/amd-ryzen-5-5600t',
    category: 'CPU',
    title: 'AMD Ryzen 5 5600T 6-Core Zen 3 Processor',
    brand: 'AMD',
    model: 'Ryzen 5 5600T Desktop Processor',
    mpn: '100-000001584',
    imageUrl: 'https://example.com/image.jpg',
    priceText: '6650',
    availabilityText: 'In Stock',
    rawSpecifications: [
      { label: 'Cores', value: '6' },
      { label: 'Threads', value: '12' },
      { label: 'Socket', value: 'AM4' },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Price parsing
// ---------------------------------------------------------------------------

describe('parseFixedPrice', () => {
  it('parses plain numeric string', () => {
    expect(parseFixedPrice('6650')).toBe(6650);
  });

  it('parses string with EGP prefix', () => {
    expect(parseFixedPrice('EGP 6650')).toBe(6650);
  });

  it('parses string with commas', () => {
    expect(parseFixedPrice('12,500')).toBe(12500);
  });

  it('parses string with pound sign', () => {
    expect(parseFixedPrice('£6,650')).toBe(6650);
  });

  it('returns null for null', () => {
    expect(parseFixedPrice(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseFixedPrice('')).toBeNull();
  });

  it('returns null for "Call for Price"', () => {
    expect(parseFixedPrice('Call for Price')).toBeNull();
  });

  it('returns null for zero', () => {
    expect(parseFixedPrice('0')).toBeNull();
  });

  it('returns null for negative', () => {
    expect(parseFixedPrice('-500')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Brand normalization
// ---------------------------------------------------------------------------

describe('normalizeBrand', () => {
  it('normalizes to lowercase trimmed', () => {
    expect(normalizeBrand('AMD')).toBe('amd');
    expect(normalizeBrand('  Intel  ')).toBe('intel');
  });

  it('returns null for null', () => {
    expect(normalizeBrand(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Model token extraction
// ---------------------------------------------------------------------------

describe('extractCoreModelToken', () => {
  it('strips "Desktop Processor" suffix', () => {
    expect(extractCoreModelToken('Ryzen 5 5600T Desktop Processor')).toBe('ryzen 5 5600t');
  });

  it('strips "Tray Desktop Processor" suffix', () => {
    expect(extractCoreModelToken('Ryzen 5 8600G Tray Desktop Processor')).toBe('ryzen 5 8600g');
  });

  it('strips "(Tray)" parenthetical', () => {
    expect(extractCoreModelToken('Ryzen 7 5700 (Tray)')).toBe('ryzen 7 5700');
  });

  it('strips "Tray" suffix', () => {
    expect(extractCoreModelToken('Ryzen 7 7700 Tray')).toBe('ryzen 7 7700');
  });

  it('returns null for null', () => {
    expect(extractCoreModelToken(null)).toBeNull();
  });

  it('returns lowercase core', () => {
    expect(extractCoreModelToken('Intel Core i9-14900K')).toBe('intel core i9-14900k');
  });
});

describe('extractModelShortToken', () => {
  it('extracts 4-digit model number', () => {
    expect(extractModelShortToken('Ryzen 5 5600T Desktop Processor')).toBe('5600t');
  });

  it('extracts 4-digit model without suffix', () => {
    expect(extractModelShortToken('Ryzen 7 5700 (Tray)')).toBe('5700');
  });

  it('returns null for null', () => {
    expect(extractModelShortToken(null)).toBeNull();
  });

  it('returns null when no digit pattern found', () => {
    expect(extractModelShortToken('No Model Number')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Eligibility checks
// ---------------------------------------------------------------------------

describe('checkEligibility', () => {
  it('returns eligible for valid CPU input', () => {
    const result = checkEligibility(makeInput());
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('OK');
  });

  it('rejects unsupported category', () => {
    const result = checkEligibility(makeInput({ category: 'KEYBOARD' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('UNSUPPORTED_CATEGORY');
  });

  it('rejects empty title', () => {
    const result = checkEligibility(makeInput({ title: '' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('EMPTY_TITLE');
  });

  it('rejects null title', () => {
    const result = checkEligibility(makeInput({ title: null }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('EMPTY_TITLE');
  });

  it('rejects empty canonical URL', () => {
    const result = checkEligibility(makeInput({ canonicalUrl: '' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('EMPTY_CANONICAL_URL');
  });

  it('rejects empty external ID', () => {
    const result = checkEligibility(makeInput({ externalId: '' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('EMPTY_EXTERNAL_ID');
  });

  it('rejects null price', () => {
    const result = checkEligibility(makeInput({ priceText: null }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('INVALID_PRICE');
  });

  it('rejects "Call for Price"', () => {
    const result = checkEligibility(makeInput({ priceText: 'Call for Price' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('INVALID_PRICE');
  });

  it('rejects zero price', () => {
    const result = checkEligibility(makeInput({ priceText: '0' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('INVALID_PRICE');
  });

  it('rejects empty availability', () => {
    const result = checkEligibility(makeInput({ availabilityText: '' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('EMPTY_AVAILABILITY');
  });
});

// ---------------------------------------------------------------------------
// Duplicate guard (unit — uses real DB)
// ---------------------------------------------------------------------------

describe('checkDuplicateGuard', () => {
  let catalogProductRepository: CatalogProductRepository;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    catalogProductRepository = new CatalogProductRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('returns CLEAR when no products exist', async () => {
    const result = await checkDuplicateGuard(makeInput(), catalogProductRepository);
    expect(result.status).toBe('CLEAR');
  });

  it('returns CLEAR when no brand', async () => {
    const result = await checkDuplicateGuard(makeInput({ brand: null }), catalogProductRepository);
    expect(result.status).toBe('CLEAR');
  });

  it('returns CLEAR when same category+brand but different model', async () => {
    await CatalogProductModel.create({
      title: 'AMD Ryzen 7 7700X Desktop Processor',
      category: 'CPU',
      brand: 'amd',
      model: 'Ryzen 7 7700X',
      mpn: '100-000000591',
      images: [],
      rawSpecifications: [],
      compatibility: null,
      buildEligibility: 'ELIGIBLE',
    });

    const result = await checkDuplicateGuard(makeInput(), catalogProductRepository);
    expect(result.status).toBe('CLEAR');
  });

  it('returns REVIEW_REQUIRED when short model token matches', async () => {
    // Seed an existing product with same short token
    await CatalogProductModel.create({
      title: 'AMD Ryzen 5 5600T Desktop Processor (OEM)',
      category: 'CPU',
      brand: 'amd',
      model: 'Ryzen 5 5600T',
      mpn: '100-000001584',
      images: [],
      rawSpecifications: [],
      compatibility: null,
      buildEligibility: 'ELIGIBLE',
    });

    const result = await checkDuplicateGuard(makeInput(), catalogProductRepository);
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.reason).toContain('PLAUSIBLE_DUPLICATE_SHORT_TOKEN:5600t');
  });

  it('returns CLEAR when model short token differs', async () => {
    await CatalogProductModel.create({
      title: 'AMD Ryzen 5 8600G Desktop Processor',
      category: 'CPU',
      brand: 'amd',
      model: 'Ryzen 5 8600G',
      mpn: '100-100001015',
      images: [],
      rawSpecifications: [],
      compatibility: null,
      buildEligibility: 'ELIGIBLE',
    });

    // 5600T has short token '5600t', existing has '8600g' → CLEAR
    const result = await checkDuplicateGuard(makeInput(), catalogProductRepository);
    expect(result.status).toBe('CLEAR');
  });

  it('returns CLEAR when 5600T is compared against plain 5600 (no suffix collision)', async () => {
    // Seed an existing "Ryzen 5 5600" product — short token = '5600', core token = 'ryzen 5 5600'
    await CatalogProductModel.create({
      title: 'AMD Ryzen 5 5600 Desktop Processor',
      category: 'CPU',
      brand: 'amd',
      model: 'Ryzen 5 5600',
      mpn: '100-100000927',
      images: [],
      rawSpecifications: [],
      compatibility: null,
      buildEligibility: 'ELIGIBLE',
    });

    // 5600T has short token '5600t' ≠ '5600', core token 'ryzen 5 5600t' ≠ 'ryzen 5 5600' → CLEAR
    const result = await checkDuplicateGuard(makeInput(), catalogProductRepository);
    expect(result.status).toBe('CLEAR');
    expect(result.reason).toBe('NO_PLAUSIBLE_DUPLICATE');
  });

  it('returns CLEAR when 5600 is compared against 5600T (reverse direction)', async () => {
    // Seed an existing "Ryzen 5 5600T" product
    await CatalogProductModel.create({
      title: 'AMD Ryzen 5 5600T Desktop Processor',
      category: 'CPU',
      brand: 'amd',
      model: 'Ryzen 5 5600T',
      mpn: '100-000001584',
      images: [],
      rawSpecifications: [],
      compatibility: null,
      buildEligibility: 'ELIGIBLE',
    });

    // New input is plain 5600 (no 'T' suffix)
    const result = await checkDuplicateGuard(
      makeInput({ model: 'Ryzen 5 5600', mpn: '100-100000927' }),
      catalogProductRepository,
    );
    expect(result.status).toBe('CLEAR');
    expect(result.reason).toBe('NO_PLAUSIBLE_DUPLICATE');
  });
});

// ---------------------------------------------------------------------------
// Full publisher integration tests
// ---------------------------------------------------------------------------

describe('StoreProductPublisher', () => {
  let publisher: StoreProductPublisher;
  let catalogProductRepository: CatalogProductRepository;
  let offerRepository: OfferRepository;
  let snapshotRepository: RawProductSnapshotRepository;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    catalogProductRepository = new CatalogProductRepository();
    offerRepository = new OfferRepository();
    snapshotRepository = new RawProductSnapshotRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    publisher = new StoreProductPublisher({
      catalogProductRepository,
      offerRepository,
      snapshotRepository,
    });
  });

  it('skips ineligible products', async () => {
    const result = await publisher.publish(makeInput({ title: '' }));
    expect(result.kind).toBe('SKIPPED_ELIGIBILITY');
    expect(result.reason).toContain('EMPTY_TITLE');
  });

  it('creates new product and offer', async () => {
    const result = await publisher.publish(makeInput());

    expect(result.kind).toBe('PUBLISHED_NEW_PRODUCT');
    expect(result.productId).toBeDefined();
    expect(result.offerId).toBeDefined();

    // Verify product in DB
    const product = await CatalogProductModel.findById(result.productId);
    expect(product).not.toBeNull();
    expect(product!.title).toBe('AMD Ryzen 5 5600T 6-Core Zen 3 Processor');
    expect(product!.category).toBe('CPU');
    expect(product!.brand).toBe('amd');
    expect(product!.model).toBe('Ryzen 5 5600T Desktop Processor');
    expect(product!.mpn).toBe('100-000001584');
    expect(product!.rawSpecifications).toHaveLength(3);

    // Verify offer in DB
    const offer = await OfferModel.findById(result.offerId);
    expect(offer).not.toBeNull();
    expect(offer!.storeCode).toBe('EL_BADR');
    expect(offer!.storeExternalId).toBe('7527');
    expect(offer!.price).toBe(6650);
    expect(offer!.currency).toBe('EGP');
    expect(offer!.availability).toBe('IN_STOCK');
  });

  it('idempotently updates existing offer on re-publish', async () => {
    const first = await publisher.publish(makeInput());
    expect(first.kind).toBe('PUBLISHED_NEW_PRODUCT');

    // Re-publish same product
    const second = await publisher.publish(makeInput());
    expect(second.kind).toBe('PUBLISHED_UPDATED_OFFER');
    expect(second.productId).toBe(first.productId);
    expect(second.offerId).toBe(first.offerId);

    // Only one product and one offer in DB
    const productCount = await CatalogProductModel.countDocuments();
    const offerCount = await OfferModel.countDocuments();
    expect(productCount).toBe(1);
    expect(offerCount).toBe(1);
  });

  it('adds offer to existing product via exact MPN match', async () => {
    // Seed a product from SIGMA store
    const existing = await CatalogProductModel.create({
      title: 'AMD Ryzen 5 5600T Desktop Processor',
      category: 'CPU',
      brand: 'amd',
      model: 'Ryzen 5 5600T',
      mpn: '100-000001584',
      images: [],
      rawSpecifications: [],
      compatibility: null,
      buildEligibility: 'ELIGIBLE',
    });

    const result = await publisher.publish(makeInput());

    expect(result.kind).toBe('PUBLISHED_ADDED_OFFER');
    expect(result.productId).toBe(String(existing._id));
    expect(result.offerId).toBeDefined();

    // One product, one offer
    const productCount = await CatalogProductModel.countDocuments();
    const offerCount = await OfferModel.countDocuments();
    expect(productCount).toBe(1);
    expect(offerCount).toBe(1);

    // Offer points to existing product
    const offer = await OfferModel.findById(result.offerId);
    expect(offer!.catalogProductId.toString()).toBe(String(existing._id));
    expect(offer!.storeCode).toBe('EL_BADR');
  });

  it('skips with duplicate guard when plausible duplicate exists', async () => {
    // Seed a product with same short model token
    await CatalogProductModel.create({
      title: 'AMD Ryzen 5 5600T OEM',
      category: 'CPU',
      brand: 'amd',
      model: 'Ryzen 5 5600T',
      mpn: 'DIFFERENT-MPN',
      images: [],
      rawSpecifications: [],
      compatibility: null,
      buildEligibility: 'ELIGIBLE',
    });

    const result = await publisher.publish(makeInput());

    expect(result.kind).toBe('SKIPPED_DUPLICATE_GUARD');
    expect(result.reason).toContain('PLAUSIBLE_DUPLICATE');

    // No new product or offer created
    const productCount = await CatalogProductModel.countDocuments();
    const offerCount = await OfferModel.countDocuments();
    expect(productCount).toBe(1); // Only the seeded one
    expect(offerCount).toBe(0);
  });

  it('creates product with empty images when imageUrl is null', async () => {
    const result = await publisher.publish(makeInput({ imageUrl: null }));
    expect(result.kind).toBe('PUBLISHED_NEW_PRODUCT');

    const product = await CatalogProductModel.findById(result.productId);
    expect(product!.images).toEqual([]);
  });

  it('maps availability text correctly', async () => {
    const result = await publisher.publish(makeInput({ availabilityText: 'Out of Stock' }));
    expect(result.kind).toBe('PUBLISHED_NEW_PRODUCT');

    const offer = await OfferModel.findById(result.offerId);
    expect(offer!.availability).toBe('OUT_OF_STOCK');
  });

  it('maps "instock" availability', async () => {
    const result = await publisher.publish(makeInput({ availabilityText: 'instock' }));
    expect(result.kind).toBe('PUBLISHED_NEW_PRODUCT');

    const offer = await OfferModel.findById(result.offerId);
    expect(offer!.availability).toBe('IN_STOCK');
  });

  it('skips OOS + exact 1 EGP placeholder price', async () => {
    const result = await publisher.publish(
      makeInput({ priceText: '1', availabilityText: 'Out of Stock' }),
    );
    expect(result.kind).toBe('SKIPPED_ELIGIBILITY');
    expect(result.reason).toContain('OOS_PLACEHOLDER_PRICE');
  });

  it('allows OOS with real price (not 1 EGP)', async () => {
    const result = await publisher.publish(
      makeInput({ priceText: '5000', availabilityText: 'Out of Stock' }),
    );
    expect(result.kind).toBe('PUBLISHED_NEW_PRODUCT');
    const offer = await OfferModel.findById(result.offerId);
    expect(offer!.availability).toBe('OUT_OF_STOCK');
    expect(offer!.price).toBe(5000);
  });

  it('creates MONITOR product as NOT_ELIGIBLE for builder', async () => {
    const result = await publisher.publish(
      makeInput({
        category: 'MONITOR',
        title: 'Gigabyte GS27QCA 27 Inch QHD Gaming Monitor',
        brand: 'Gigabyte',
        model: 'GS27QCA',
        mpn: 'GS27QCA',
      }),
    );
    expect(result.kind).toBe('PUBLISHED_NEW_PRODUCT');
    const product = await CatalogProductModel.findById(result.productId);
    expect(product!.buildEligibility).toBe('NOT_ELIGIBLE');
  });

  it('creates CPU product as ELIGIBLE for builder', async () => {
    const result = await publisher.publish(makeInput());
    expect(result.kind).toBe('PUBLISHED_NEW_PRODUCT');
    const product = await CatalogProductModel.findById(result.productId);
    expect(product!.buildEligibility).toBe('ELIGIBLE');
  });
});

// ---------------------------------------------------------------------------
// resolveCategoryFromBreadcrumbs
// ---------------------------------------------------------------------------

describe('resolveCategoryFromBreadcrumbs', () => {
  it('returns first recognized category from breadcrumbs', () => {
    expect(resolveCategoryFromBreadcrumbs(['Home', 'CPU', 'AMD Ryzen'], 'FALLBACK')).toBe('CPU');
  });

  it('returns category hint at position 0 when present', () => {
    expect(resolveCategoryFromBreadcrumbs(['MONITOR', 'Home', 'Shop'], 'FALLBACK')).toBe('MONITOR');
  });

  it('is case-insensitive', () => {
    expect(resolveCategoryFromBreadcrumbs(['cpu', 'Home'], 'FALLBACK')).toBe('CPU');
  });

  it('returns fallback when no recognized category found', () => {
    expect(resolveCategoryFromBreadcrumbs(['Home', 'Shop', 'Product'], 'FALLBACK')).toBe('FALLBACK');
  });

  it('returns fallback for empty breadcrumbs', () => {
    expect(resolveCategoryFromBreadcrumbs([], 'FALLBACK')).toBe('FALLBACK');
  });

  it('skips unrecognized entries to find recognized one', () => {
    expect(
      resolveCategoryFromBreadcrumbs(['Home', 'Computers', 'Components', 'MONITOR', 'Product'], 'X'),
    ).toBe('MONITOR');
  });

  it('translates Arabic breadcrumb "باور سبلاي" to PSU', () => {
    expect(
      resolveCategoryFromBreadcrumbs(['Home', 'مكونات كمبيوتر', 'باور سبلاي', 'Product'], 'FALLBACK'),
    ).toBe('PSU');
  });

  it('translates Arabic breadcrumb "كيسه كمبيوتر" to CASE', () => {
    expect(
      resolveCategoryFromBreadcrumbs(['Home', 'مكونات كمبيوتر', 'كيسه كمبيوتر', 'Product'], 'FALLBACK'),
    ).toBe('CASE');
  });

  it('translates Arabic breadcrumb "تبريد" to COOLING', () => {
    expect(
      resolveCategoryFromBreadcrumbs(['Home', 'مكونات كمبيوتر', 'تبريد', 'Product'], 'FALLBACK'),
    ).toBe('COOLING');
  });

  it('prefers direct English match over Arabic translation', () => {
    expect(
      resolveCategoryFromBreadcrumbs(['PSU', 'باور سبلاي'], 'FALLBACK'),
    ).toBe('PSU');
  });
});
