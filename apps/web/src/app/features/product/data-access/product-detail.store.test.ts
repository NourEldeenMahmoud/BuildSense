import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProductDetailStore,
  selectCurrentOffer,
  isOfferAvailable,
  hasValidPrice,
  toViewModel,
} from './product-detail.store';
import { CatalogService } from '../../catalog/data-access/catalog.service';
import type {
  CatalogProductDetail,
  CatalogProductOffer,
} from '../../../shared/contracts/catalog';

// ---------------------------------------------------------------------------
// Deterministic offer selection — pure function tests
// ---------------------------------------------------------------------------

const makeOffer = (overrides: Partial<CatalogProductOffer> = {}): CatalogProductOffer => ({
  id: 'offer-1',
  storeCode: 'SIGMA',
  price: 10000,
  currency: 'EGP',
  availability: 'IN_STOCK',
  sourceUrl: 'https://sigma.com/item/1',
  ...overrides,
});

describe('isOfferAvailable', () => {
  it('returns true for IN_STOCK', () => {
    expect(isOfferAvailable(makeOffer({ availability: 'IN_STOCK' }))).toBe(true);
  });

  it('returns false for OUT_OF_STOCK', () => {
    expect(isOfferAvailable(makeOffer({ availability: 'OUT_OF_STOCK' }))).toBe(false);
  });

  it('returns false for UNKNOWN', () => {
    expect(isOfferAvailable(makeOffer({ availability: 'UNKNOWN' }))).toBe(false);
  });

  it('returns false for PREORDER', () => {
    expect(isOfferAvailable(makeOffer({ availability: 'PREORDER' }))).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOfferAvailable(makeOffer({ availability: '' }))).toBe(false);
  });
});

describe('hasValidPrice', () => {
  it('returns true for positive price', () => {
    expect(hasValidPrice(makeOffer({ price: 100 }))).toBe(true);
  });

  it('returns true for zero price', () => {
    expect(hasValidPrice(makeOffer({ price: 0 }))).toBe(true);
  });

  it('returns false for null price', () => {
    expect(hasValidPrice(makeOffer({ price: null }))).toBe(false);
  });

  it('returns false for negative price', () => {
    expect(hasValidPrice(makeOffer({ price: -100 }))).toBe(false);
  });

  it('returns false for NaN price', () => {
    expect(hasValidPrice(makeOffer({ price: NaN }))).toBe(false);
  });
});

describe('selectCurrentOffer', () => {
  it('returns null for empty array', () => {
    expect(selectCurrentOffer([])).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(selectCurrentOffer(null as unknown as CatalogProductOffer[])).toBeNull();
    expect(selectCurrentOffer(undefined as unknown as CatalogProductOffer[])).toBeNull();
  });

  it('prefers available + lowest price', () => {
    const offers = [
      makeOffer({ id: 'a', availability: 'IN_STOCK', price: 20000 }),
      makeOffer({ id: 'b', availability: 'IN_STOCK', price: 15000 }),
      makeOffer({ id: 'c', availability: 'OUT_OF_STOCK', price: 10000 }),
    ];
    const result = selectCurrentOffer(offers);
    expect(result?.id).toBe('b');
  });

  it('falls back to lowest price among all when none available', () => {
    const offers = [
      makeOffer({ id: 'a', availability: 'OUT_OF_STOCK', price: 20000 }),
      makeOffer({ id: 'b', availability: 'UNKNOWN', price: 5000 }),
      makeOffer({ id: 'c', availability: 'OUT_OF_STOCK', price: 15000 }),
    ];
    const result = selectCurrentOffer(offers);
    expect(result?.id).toBe('b');
  });

  it('uses first offer as fallback when no offer has a valid price', () => {
    const offers = [
      makeOffer({ id: 'a', availability: 'IN_STOCK', price: null }),
      makeOffer({ id: 'b', availability: 'OUT_OF_STOCK', price: null }),
    ];
    const result = selectCurrentOffer(offers);
    expect(result?.id).toBe('a');
  });

  it('single offer with valid price returns that offer', () => {
    const offers = [makeOffer({ id: 'solo', price: 8000, availability: 'IN_STOCK' })];
    const result = selectCurrentOffer(offers);
    expect(result?.id).toBe('solo');
  });

  it('does not depend on array order for selection (available lowest)', () => {
    // Put the lowest price last among available
    const offers = [
      makeOffer({ id: 'first', availability: 'IN_STOCK', price: 30000 }),
      makeOffer({ id: 'second', availability: 'OUT_OF_STOCK', price: 1000 }),
      makeOffer({ id: 'third', availability: 'IN_STOCK', price: 12000 }),
    ];
    const result = selectCurrentOffer(offers);
    expect(result?.id).toBe('third');
  });

  it('prefers available over cheaper unavailable', () => {
    const offers = [
      makeOffer({ id: 'unavail-cheap', availability: 'OUT_OF_STOCK', price: 1000 }),
      makeOffer({ id: 'avail-expensive', availability: 'IN_STOCK', price: 50000 }),
    ];
    const result = selectCurrentOffer(offers);
    expect(result?.id).toBe('avail-expensive');
  });

  it('skips negative prices and selects valid offer', () => {
    const offers = [
      makeOffer({ id: 'neg', price: -1000, availability: 'IN_STOCK' }),
      makeOffer({ id: 'valid', price: 15000, availability: 'IN_STOCK' }),
    ];
    const result = selectCurrentOffer(offers);
    expect(result?.id).toBe('valid');
  });

  it('skips NaN prices and selects valid offer', () => {
    const offers = [
      makeOffer({ id: 'nan', price: NaN, availability: 'IN_STOCK' }),
      makeOffer({ id: 'valid', price: 15000, availability: 'IN_STOCK' }),
    ];
    const result = selectCurrentOffer(offers);
    expect(result?.id).toBe('valid');
  });

  it('falls back to first offer when all prices are invalid', () => {
    const offers = [
      makeOffer({ id: 'first', price: -500, availability: 'IN_STOCK' }),
      makeOffer({ id: 'second', price: NaN, availability: 'OUT_OF_STOCK' }),
    ];
    const result = selectCurrentOffer(offers);
    expect(result?.id).toBe('first');
  });
});

describe('toViewModel', () => {
  const makeProduct = (overrides: Partial<CatalogProductDetail> = {}): CatalogProductDetail => ({
    id: 'prod-123',
    title: 'Test Product',
    category: 'CPU',
    brand: 'Intel',
    model: 'Core i7',
    mpn: 'BX80715',
    images: ['https://img1.jpg', 'https://img2.jpg'],
    rawSpecifications: [
      { label: 'Cores', value: '8' },
      { label: 'Threads', value: '16' },
    ],
    compatibility: {},
    createdAt: '2024-01-01',
    offers: [
      makeOffer({ id: 'o1', price: 20000, availability: 'IN_STOCK' }),
    ],
    ...overrides,
  });

  it('maps fields correctly', () => {
    const vm = toViewModel(makeProduct());
    expect(vm.id).toBe('prod-123');
    expect(vm.title).toBe('Test Product');
    expect(vm.category).toBe('CPU');
    expect(vm.brand).toBe('Intel');
    expect(vm.images).toEqual(['https://img1.jpg', 'https://img2.jpg']);
    expect(vm.primaryImageUrl).toBe('https://img1.jpg');
  });

  it('sets primaryImageUrl to null when images empty', () => {
    const vm = toViewModel(makeProduct({ images: [] }));
    expect(vm.primaryImageUrl).toBeNull();
  });

  it('picks correct current offer via deterministic selection', () => {
    const product = makeProduct({
      offers: [
        makeOffer({ id: 'cheap-unavail', price: 5000, availability: 'OUT_OF_STOCK' }),
        makeOffer({ id: 'mid-avail', price: 15000, availability: 'IN_STOCK' }),
        makeOffer({ id: 'exp-avail', price: 25000, availability: 'IN_STOCK' }),
      ],
    });
    const vm = toViewModel(product);
    expect(vm.currentOffer?.id).toBe('mid-avail');
    expect(vm.hasMultipleOffers).toBe(true);
  });

  it('hasMultipleOffers is false for single offer', () => {
    const vm = toViewModel(makeProduct());
    expect(vm.hasMultipleOffers).toBe(false);
  });

  it('maps availability text from current offer', () => {
    const vm = toViewModel(makeProduct());
    expect(vm.availabilityText).toBe('IN_STOCK');
  });

  it('defaults availability text when no offers', () => {
    const vm = toViewModel(makeProduct({ offers: [] }));
    expect(vm.availabilityText).toBe('Availability unknown');
  });

  it('preserves raw spec order', () => {
    const specs = [
      { label: 'Z', value: '1' },
      { label: 'A', value: '2' },
      { label: 'M', value: '3' },
    ];
    const vm = toViewModel(makeProduct({ rawSpecifications: specs }));
    expect(vm.rawSpecifications.map(s => s.label)).toEqual(['Z', 'A', 'M']);
  });
});

// ---------------------------------------------------------------------------
// Store integration tests
// ---------------------------------------------------------------------------

describe('ProductDetailStore', () => {
  let store: ProductDetailStore;
  let mockService: { getProductById: ReturnType<typeof vi.fn> };
  let paramsSubject: Subject<unknown>;

  const PRODUCT_DETAIL: CatalogProductDetail = {
    id: '64a00000000000000000abc',
    title: 'Intel Core i7-13700K',
    category: 'CPU',
    brand: 'Intel',
    model: 'Core i7-13700K',
    mpn: 'BX8071513700K',
    images: ['https://img.example.com/1.jpg'],
    rawSpecifications: [
      { label: 'Cores', value: '16' },
      { label: 'Threads', value: '24' },
    ],
    compatibility: {},
    createdAt: '2024-01-01',
    offers: [
      {
        id: 'offer-1',
        storeCode: 'SIGMA',
        price: 25000,
        currency: 'EGP',
        availability: 'IN_STOCK',
        sourceUrl: 'https://sigma.com/item/123',
      },
    ],
  };

  beforeEach(() => {
    paramsSubject = new Subject();

    mockService = {
      getProductById: vi.fn().mockReturnValue(of(PRODUCT_DETAIL)),
    };

    TestBed.configureTestingModule({
      providers: [
        ProductDetailStore,
        { provide: CatalogService, useValue: mockService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramsSubject.asObservable(),
          },
        },
      ],
    });

    store = TestBed.inject(ProductDetailStore);
  });

  it('starts in idle state', () => {
    expect(store.status()).toBe('idle');
    expect(store.viewModel()).toBeNull();
  });

  it('loads product detail on valid route param', async () => {
    paramsSubject.next(convertToParamMap({ productId: '64a00000000000000000abc' }));
    await flushPromises();

    expect(store.loaded()).toBe(true);
    expect(store.viewModel()?.title).toBe('Intel Core i7-13700K');
    expect(mockService.getProductById).toHaveBeenCalledWith('64a00000000000000000abc');
  });

  it('shows invalid-id for empty productId', async () => {
    paramsSubject.next(convertToParamMap({ productId: '' }));
    await flushPromises();

    expect(store.invalidId()).toBe(true);
    expect(mockService.getProductById).not.toHaveBeenCalled();
  });

  it('shows not-found for 404 error', async () => {
    mockService.getProductById.mockReturnValue(
      throwError(() => ({ status: 404, error: { message: 'Not found' } }))
    );
    paramsSubject.next(convertToParamMap({ productId: 'missing-id' }));
    await flushPromises();

    expect(store.notFound()).toBe(true);
    expect(store.errorMessage()).toBe('Product not found.');
  });

  it('shows api-error for 500 error with retry', async () => {
    mockService.getProductById
      .mockReturnValueOnce(
        throwError(() => ({ status: 500, error: { message: 'Server error' } }))
      )
      .mockReturnValueOnce(of(PRODUCT_DETAIL));

    paramsSubject.next(convertToParamMap({ productId: 'some-id' }));
    await flushPromises();

    expect(store.apiError()).toBe(true);

    store.retry();
    await flushPromises();

    expect(store.loaded()).toBe(true);
    expect(mockService.getProductById).toHaveBeenCalledTimes(2);
  });

  it('clears product when route changes to new ID', async () => {
    paramsSubject.next(convertToParamMap({ productId: '64a00000000000000000abc' }));
    await flushPromises();
    expect(store.loaded()).toBe(true);

    // Switch to new product
    paramsSubject.next(convertToParamMap({ productId: '64a00000000000000000def' }));
    await flushPromises();
    expect(store.productId()).toBe('64a00000000000000000def');
    expect(mockService.getProductById).toHaveBeenCalledTimes(2);
  });
});

// Helper to flush promises
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
