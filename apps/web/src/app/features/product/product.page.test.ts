import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { ProductPage } from './product.page';
import { ProductDetailStore } from './data-access/product-detail.store';
import { CatalogService } from '../catalog/data-access/catalog.service';
import type { CatalogProductDetail } from '../../shared/contracts/catalog';

const FULL_PRODUCT: CatalogProductDetail = {
  id: '64a00000000000000000abc',
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

  async function setup(product: CatalogProductDetail): Promise<void> {
    const mockService = {
      getProductById: vi.fn().mockReturnValue(of(product)),
    };

    await TestBed.configureTestingModule({
      imports: [ProductPage, RouterTestingModule],
      providers: [
        ProductDetailStore,
        { provide: CatalogService, useValue: mockService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ productId: product.id })),
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

  it('displays disabled Builder button', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector('button[aria-label*="Builder"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('displays disabled Compare button', async () => {
    await setup(FULL_PRODUCT);
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector('button[aria-label*="Compare"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
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
