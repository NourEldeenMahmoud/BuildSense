import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ProductPage } from './product.page';
import { ProductDetailStore } from './data-access/product-detail.store';
import { CatalogService } from '../catalog/data-access/catalog.service';
import { CompareStore } from '../compare/data-access/compare.store';
import { CompareCandidateSearchService } from '../compare/data-access/compare-candidate-search.service';
import { CompareSelectorComponent } from '../compare/ui/compare-selector.component';
import type { CatalogProductDetail } from '../../shared/contracts/catalog';
import { BuildService } from '../builder/data-access/build.service';

const FULL_PRODUCT: CatalogProductDetail = {
  id: '64a000000000000000000001',
  title: 'Intel Core i7-13700K Processor',
  category: 'CPU',
  brand: 'Intel',
  model: 'Core i7-13700K',
  mpn: 'BX8071513700K',
  images: [
    'https://img.example.com/1.jpg',
    'https://img.example.com/2.jpg',
    'https://img.example.com/3.jpg',
  ],
  rawSpecifications: [
    { label: 'Cores', value: '16' },
    { label: 'Threads', value: '24' },
    { label: 'Base Clock', value: '3.4 GHz' },
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

const SPARSE_PRODUCT: CatalogProductDetail = {
  ...FULL_PRODUCT,
  id: 'sparse-123',
  brand: null,
  model: null,
  mpn: null,
  images: [],
  rawSpecifications: [],
  offers: [],
};

const NO_OFFER_PRODUCT: CatalogProductDetail = {
  ...FULL_PRODUCT,
  id: 'no-offer-123',
  offers: [],
};

const MULTI_OFFER_PRODUCT: CatalogProductDetail = {
  ...FULL_PRODUCT,
  id: 'multi-offer-123',
  offers: [
    {
      id: 'offer-a',
      storeCode: 'SIGMA',
      price: 25000,
      currency: 'EGP',
      availability: 'IN_STOCK',
      sourceUrl: 'https://sigma.com/item/a',
    },
    {
      id: 'offer-b',
      storeCode: 'COMPUMART',
      price: 27000,
      currency: 'EGP',
      availability: 'OUT_OF_STOCK',
      sourceUrl: 'https://compumart.com/item/b',
    },
  ],
};

describe('ProductPage', () => {
  let fixture: ComponentFixture<ProductPage>;
  let mockBuildService: {
    createBuild: ReturnType<typeof vi.fn>;
    getBuild: ReturnType<typeof vi.fn>;
    putItem: ReturnType<typeof vi.fn>;
  };

  const build = {
    publicId: 'build-123',
    name: 'Untitled Build',
    version: 1,
    items: [],
    compatibility: { overallStatus: 'UNKNOWN', slots: [] },
    pricing: { totalPrice: null, itemCount: 0 },
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  async function setup(product: CatalogProductDetail): Promise<void> {
    const mockService = {
      getProductById: vi.fn().mockReturnValue(of(product)),
    };

    mockBuildService = {
      createBuild: vi.fn().mockReturnValue(of(build)),
      getBuild: vi.fn().mockReturnValue(of(build)),
      putItem: vi.fn().mockReturnValue(of({ ...build, version: 2 })),
    };

    const mockCandidateSearch = {
      results: signal([]),
      loading: signal(false),
      hasMore: signal(false),
      error: signal<string | null>(null),
      search: vi.fn(),
      nextPage: vi.fn(),
      reset: vi.fn(),
      resetForNewSlot: vi.fn(),
    };

    const mockCompareStore = {
      leftProduct: signal(null),
      rightProduct: signal(null),
      leftStatus: signal('idle' as const),
      rightStatus: signal('idle' as const),
      categoryMismatch: signal(false),
      queryState: signal({ left: null, right: null }),
    };

    await TestBed.configureTestingModule({
      imports: [ProductPage, RouterTestingModule, CompareSelectorComponent],
      providers: [
        ProductDetailStore,
        { provide: CatalogService, useValue: mockService },
        { provide: BuildService, useValue: mockBuildService },
        { provide: CompareStore, useValue: mockCompareStore },
        { provide: CompareCandidateSearchService, useValue: mockCandidateSearch },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ productId: product.id })),
            snapshot: {
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders product title', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Intel Core i7-13700K Processor');
  });

  it('renders breadcrumb with category', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Home');
    expect(el.textContent).toContain('CPU');
  });

  it('renders current price when available', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('25,000');
    expect(el.textContent).toContain('EGP');
  });

  it('renders availability status', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('In stock');
  });

  it('renders source link with safe attributes', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector('.source-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
    expect(link.href).toContain('sigma.com');
  });

  it('renders MPN when present', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('MPN: BX8071513700K');
  });

  it('does not render MPN when null', async () => {
    await setup(SPARSE_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('MPN:');
  });

  it('renders raw specifications in order', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Cores');
    expect(el.textContent).toContain('16');
    expect(el.textContent).toContain('Threads');
    expect(el.textContent).toContain('24');
  });

  it('renders em dash for empty spec values', async () => {
    const productWithEmptySpec = {
      ...FULL_PRODUCT,
      rawSpecifications: [{ label: 'Empty Field', value: '' }],
    };
    await setup(productWithEmptySpec);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Empty Field');
    expect(el.textContent).toContain('\u2014');
  });

  it('adds an eligible product to a new build and navigates to it', async () => {
    await setup(FULL_PRODUCT);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector('button[aria-label*="Builder"]') as HTMLButtonElement;

    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);

    btn.click();
    fixture.detectChanges();

    expect(mockBuildService.createBuild).toHaveBeenCalledOnce();
    expect(mockBuildService.putItem).toHaveBeenCalledWith('build-123', 'cpu', {
      productId: FULL_PRODUCT.id,
      quantity: 1,
      expectedVersion: 1,
    });
    expect(navigate).toHaveBeenCalledWith(['/builder', 'build-123']);
    expect(window.localStorage.getItem('buildsense:latestBuildId')).toBe('build-123');
  });

  it('displays enabled Compare button when product has category', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector('button[aria-label*="Compare"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
  });

  it('does not show offers section for single offer', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    // offers-section should NOT exist when only 1 offer
    expect(el.querySelector('.offers-section')).toBeFalsy();
  });

  it('shows offers section when multiple offers', async () => {
    await setup(MULTI_OFFER_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.offers-section')).toBeTruthy();
    expect(el.textContent).toContain('SIGMA');
    expect(el.textContent).toContain('COMPUMART');
  });

  it('shows no-offer message when no offers', async () => {
    await setup(NO_OFFER_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No pricing information available');
  });

  it('shows fallback image when images empty', async () => {
    await setup(SPARSE_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.gallery-image-fallback')).toBeTruthy();
  });

  it('shows gallery thumbnails when multiple images', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    const thumbs = el.querySelectorAll('.gallery-thumb');
    expect(thumbs.length).toBe(3);
  });

  it('does not show gallery thumbnails for single image', async () => {
    const singleImage = { ...FULL_PRODUCT, images: ['https://img.example.com/1.jpg'] };
    await setup(singleImage);
    const el: HTMLElement = fixture.nativeElement;
    const thumbs = el.querySelectorAll('.gallery-thumb');
    expect(thumbs.length).toBe(0);
  });
});
