import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompareStore } from './compare.store';
import { CatalogService } from '../../catalog/data-access/catalog.service';
import type { CatalogProductDetail } from '../../../shared/contracts/catalog';

const CPU_PRODUCT_A: CatalogProductDetail = {
  id: '64a000000000000000000001',
  title: 'Intel Core i7-13700K Processor',
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

const CPU_PRODUCT_B: CatalogProductDetail = {
  ...CPU_PRODUCT_A,
  id: '64a000000000000000000002',
  title: 'AMD Ryzen 9 7950X Processor',
  brand: 'AMD',
  model: 'Ryzen 9 7950X',
  mpn: '100-100000593WOF',
  rawSpecifications: [
    { label: 'Cores', value: '16' },
    { label: 'Threads', value: '32' },
    { label: 'TDP', value: '170W' },
  ],
  offers: [
    {
      id: 'offer-2',
      storeCode: 'SIGMA',
      price: 32000,
      currency: 'EGP',
      availability: 'IN_STOCK',
      sourceUrl: 'https://sigma.com/item/456',
    },
  ],
};

const GPU_PRODUCT: CatalogProductDetail = {
  ...CPU_PRODUCT_A,
  id: '64a000000000000000000003',
  title: 'NVIDIA RTX 4080',
  category: 'GPU',
  brand: 'NVIDIA',
  rawSpecifications: [
    { label: 'VRAM', value: '16 GB' },
  ],
};

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('CompareStore', () => {
  let store: CompareStore;
  let mockService: {
    getProductById: ReturnType<typeof vi.fn>;
    getProducts: ReturnType<typeof vi.fn>;
  };
  let queryParamsSubject: Subject<Record<string, string>>;

  beforeEach(() => {
    queryParamsSubject = new Subject();
    mockService = {
      getProductById: vi.fn(),
      getProducts: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        CompareStore,
        { provide: CatalogService, useValue: mockService },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParamsSubject.asObservable() },
        },
      ],
    });

    store = TestBed.inject(CompareStore);
  });

  it('starts in missing state', () => {
    expect(store.queryState()).toBe('missing');
  });

  it('fetches both products concurrently on valid params', async () => {
    mockService.getProductById
      .mockReturnValueOnce(of(CPU_PRODUCT_A))
      .mockReturnValueOnce(of(CPU_PRODUCT_B));

    queryParamsSubject.next({
      left: '64a000000000000000000001',
      right: '64a000000000000000000002',
    });
    await flushPromises();

    expect(store.queryState()).toBe('valid');
    expect(store.loaded()).toBe(true);
    expect(store.leftVm()?.title).toBe('Intel Core i7-13700K Processor');
    expect(store.rightVm()?.title).toBe('AMD Ryzen 9 7950X Processor');
    expect(store.leftStatus()).toBe('loaded');
    expect(store.rightStatus()).toBe('loaded');
    expect(mockService.getProductById).toHaveBeenCalledTimes(2);
  });

  it('sets malformed-left for invalid left ID', async () => {
    queryParamsSubject.next({ left: 'bad', right: '64a000000000000000000002' });
    await flushPromises();

    expect(store.queryState()).toBe('malformed-left');
    expect(mockService.getProductById).not.toHaveBeenCalled();
  });

  it('sets duplicates for identical IDs', async () => {
    queryParamsSubject.next({
      left: '64a000000000000000000001',
      right: '64a000000000000000000001',
    });
    await flushPromises();

    expect(store.queryState()).toBe('duplicates');
    expect(mockService.getProductById).not.toHaveBeenCalled();
  });

  it('tracks left not-found independently', async () => {
    mockService.getProductById
      .mockReturnValueOnce(throwError(() => ({ status: 404 })))
      .mockReturnValueOnce(of(CPU_PRODUCT_B));

    queryParamsSubject.next({
      left: '64a000000000000000000001',
      right: '64a000000000000000000002',
    });
    await flushPromises();

    expect(store.leftNotFound()).toBe(true);
    expect(store.rightStatus()).toBe('loaded');
    expect(store.hasAnyError()).toBe(true);
  });

  it('tracks right API error independently', async () => {
    mockService.getProductById
      .mockReturnValueOnce(of(CPU_PRODUCT_A))
      .mockReturnValueOnce(throwError(() => ({ status: 500 })));

    queryParamsSubject.next({
      left: '64a000000000000000000001',
      right: '64a000000000000000000002',
    });
    await flushPromises();

    expect(store.rightApiError()).toBe(true);
    expect(store.leftStatus()).toBe('loaded');
    expect(store.rightErrorMessage()).toBe('Failed to load product details.');
  });

  it('detects category mismatch', async () => {
    mockService.getProductById
      .mockReturnValueOnce(of(CPU_PRODUCT_A))
      .mockReturnValueOnce(of(GPU_PRODUCT));

    queryParamsSubject.next({
      left: '64a000000000000000000001',
      right: '64a000000000000000000003',
    });
    await flushPromises();

    expect(store.categoryMismatch()).toBe(true);
    expect(store.loaded()).toBe(true);
  });

  it('does not flag category mismatch for same category with different case/whitespace', async () => {
    const productBCaps = { ...CPU_PRODUCT_B, category: '  cpu  ' };
    mockService.getProductById
      .mockReturnValueOnce(of(CPU_PRODUCT_A))
      .mockReturnValueOnce(of(productBCaps));

    queryParamsSubject.next({
      left: '64a000000000000000000001',
      right: '64a000000000000000000002',
    });
    await flushPromises();

    expect(store.categoryMismatch()).toBe(false);
  });

  it('clears previous products on URL change', async () => {
    mockService.getProductById
      .mockReturnValueOnce(of(CPU_PRODUCT_A))
      .mockReturnValueOnce(of(CPU_PRODUCT_B));

    queryParamsSubject.next({
      left: '64a000000000000000000001',
      right: '64a000000000000000000002',
    });
    await flushPromises();
    expect(store.loaded()).toBe(true);

    // Now change to new IDs
    const productC = { ...CPU_PRODUCT_A, id: '64a0000000000000000000ff', title: 'Product C' };
    const productD = { ...CPU_PRODUCT_B, id: '64a0000000000000000000dd', title: 'Product D' };
    mockService.getProductById
      .mockReturnValueOnce(of(productC))
      .mockReturnValueOnce(of(productD));

    queryParamsSubject.next({
      left: '64a0000000000000000000ff',
      right: '64a0000000000000000000dd',
    });
    await flushPromises();

    expect(store.leftVm()?.title).toBe('Product C');
    expect(store.rightVm()?.title).toBe('Product D');
  });

  it('clears data on malformed URL after valid', async () => {
    mockService.getProductById
      .mockReturnValueOnce(of(CPU_PRODUCT_A))
      .mockReturnValueOnce(of(CPU_PRODUCT_B));

    queryParamsSubject.next({
      left: '64a000000000000000000001',
      right: '64a000000000000000000002',
    });
    await flushPromises();
    expect(store.loaded()).toBe(true);

    queryParamsSubject.next({ left: 'bad', right: '64a000000000000000000002' });
    await flushPromises();
    expect(store.queryState()).toBe('malformed-left');
    expect(store.leftVm()).toBeNull();
    expect(store.rightVm()).toBeNull();
  });
});
