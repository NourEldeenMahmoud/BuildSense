import { describe, expect, it } from 'vitest';
import { mapSigmaProductToRaw } from './raw-product-mapper.js';
import type { SigmaProduct } from './types.js';

function makeSigmaProduct(overrides: Partial<SigmaProduct> = {}): SigmaProduct {
  return {
    id: '9f503b67-b433-4434-8879-ebd003dce713',
    slug: 'test-product',
    name: 'Test Product',
    sku: 'SKU-123',
    description: 'A test product description',
    tags: [],
    points: null,
    barcode: null,
    views: { total: 0, unique: 0, live: 0 },
    review: { stars: null, total: 0 },
    price: {
      base: 1500,
      current: 1200,
      discount_percentage: 20,
      currency: 'EGP',
    },
    thumbnail: { id: '1', url: 'https://example.com/thumb.jpg', type: 'image' },
    media: [
      { id: '1', url: 'https://example.com/img1.jpg', type: 'image' },
      { id: '2', url: 'https://example.com/img2.jpg', type: 'image' },
    ],
    minimum_order_count: 1,
    maximum_order_count: 10,
    warranty: '1 Year',
    seller_notes: null,
    return_policy: null,
    seller: null,
    category: {
      id: 'cat-1',
      slug: 'category',
      name: 'Test Category',
      is_subcategory: false,
    },
    brand: {
      id: 'brand-1',
      name: 'TestBrand',
      slug: 'testbrand',
      image: null,
      is_featured: false,
    },
    vendor: null,
    specifications: [
      {
        id: 'spec-1',
        name: 'Capacity',
        order: 1,
        priority: 1,
        value: '16GB',
        meta: [],
      },
      {
        id: 'spec-2',
        name: 'Type',
        order: 2,
        priority: 1,
        value: 'DDR5',
        meta: [],
      },
    ],
    is_discount: true,
    is_wishlist: false,
    is_stock: true,
    is_best_seller: false,
    is_featured: false,
    is_sub_product: false,
    variant_attributes: null,
    sub_products: [],
    is_free_shipping: false,
    ...overrides,
  };
}

describe('mapSigmaProductToRaw', () => {
  it('extracts valid externalId from UUID', () => {
    const product = makeSigmaProduct({ id: '9f503b67-b433-4434-8879-ebd003dce713' });
    const { externalId, warnings } = mapSigmaProductToRaw(product, []);

    expect(externalId).toBe('9f503b67-b433-4434-8879-ebd003dce713');
    expect(warnings).toHaveLength(0);
  });

  it('returns null externalId and warning for invalid UUID', () => {
    const product = makeSigmaProduct({ id: 'not-a-uuid' });
    const { externalId, warnings } = mapSigmaProductToRaw(product, []);

    expect(externalId).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('INVALID_EXTERNAL_ID');
  });

  it('maps price fields correctly', () => {
    const product = makeSigmaProduct();
    const { raw } = mapSigmaProductToRaw(product, []);

    expect(raw.priceText).toBe('1200');
    expect(raw.oldPriceText).toBe('1500');
  });

  it('maps availability from is_stock', () => {
    const product = makeSigmaProduct({ is_stock: true });
    const { raw } = mapSigmaProductToRaw(product, []);

    expect(raw.availabilityText).toBe('true');
  });

  it('maps brand name', () => {
    const product = makeSigmaProduct();
    const { raw } = mapSigmaProductToRaw(product, []);

    expect(raw.brandText).toBe('TestBrand');
  });

  it('maps specifications', () => {
    const product = makeSigmaProduct();
    const { raw } = mapSigmaProductToRaw(product, []);

    expect(raw.specifications).toHaveLength(2);
    expect(raw.specifications[0]).toEqual({ label: 'Capacity', value: '16GB' });
    expect(raw.specifications[1]).toEqual({ label: 'Type', value: 'DDR5' });
  });

  it('maps image URLs from media', () => {
    const product = makeSigmaProduct();
    const { raw } = mapSigmaProductToRaw(product, []);

    expect(raw.imageUrls).toEqual([
      'https://example.com/img1.jpg',
      'https://example.com/img2.jpg',
    ]);
  });

  it('maps breadcrumbs', () => {
    const product = makeSigmaProduct();
    const breadcrumbs = [
      { level: 0, label: 'Home', href: '/' },
      { level: 1, label: 'CPU', href: '/en/category/cpu' },
    ];
    const { raw } = mapSigmaProductToRaw(product, breadcrumbs);

    expect(raw.breadcrumbs).toEqual(['Home', 'CPU']);
  });

  it('maps description', () => {
    const product = makeSigmaProduct({ description: 'Product description here' });
    const { raw } = mapSigmaProductToRaw(product, []);

    expect(raw.descriptionText).toBe('Product description here');
  });

  it('handles null brand', () => {
    const product = makeSigmaProduct({ brand: null });
    const { raw } = mapSigmaProductToRaw(product, []);

    expect(raw.brandText).toBeNull();
  });

  it('handles empty media array', () => {
    const product = makeSigmaProduct({ media: [] });
    const { raw } = mapSigmaProductToRaw(product, []);

    expect(raw.imageUrls).toEqual([]);
  });

  it('filters out media items with empty URLs', () => {
    const product = makeSigmaProduct({
      media: [
        { id: '1', url: 'https://example.com/img1.jpg', type: 'image' },
        { id: '2', url: '', type: 'image' },
        { id: '3', url: 'https://example.com/img3.jpg', type: 'image' },
      ],
    });
    const { raw } = mapSigmaProductToRaw(product, []);

    expect(raw.imageUrls).toEqual([
      'https://example.com/img1.jpg',
      'https://example.com/img3.jpg',
    ]);
  });
});
