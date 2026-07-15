import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogProductCardComponent } from './catalog-product-card.component';
import type { CatalogProductListItem } from '../../../shared/contracts/catalog';

const makeProduct = (overrides: Partial<CatalogProductListItem> = {}): CatalogProductListItem => ({
  id: 'abc123',
  title: 'Test CPU',
  category: 'CPU',
  brand: 'Intel',
  model: 'Core i7',
  mpn: 'BX8071513700',
  images: ['https://example.com/img.jpg'],
  price: 12000,
  currency: 'EGP',
  availability: 'IN_STOCK',
  sourceUrl: 'https://sigma-computer.com/product/123',
  createdAt: '2024-01-01',
  ...overrides
});

describe('CatalogProductCardComponent', () => {
  let component: CatalogProductCardComponent;
  let fixture: ComponentFixture<CatalogProductCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogProductCardComponent, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogProductCardComponent);
    component = fixture.componentInstance;
  });

  it('should render product title', () => {
    component.product = makeProduct({ title: 'ASUS ROG GPU' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('ASUS ROG GPU');
  });

  it('should render price when present', () => {
    component.product = makeProduct({ price: 12000, currency: 'EGP' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('12,000');
    expect(el.textContent).toContain('EGP');
  });

  it('should render price unknown marker when price is null', () => {
    component.product = makeProduct({ price: null });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.price-unknown')).toBeTruthy();
  });

  it('should show out-of-stock badge when availability is OUT_OF_STOCK', () => {
    component.product = makeProduct({ availability: 'OUT_OF_STOCK' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.out-of-stock-badge')).toBeTruthy();
  });

  it('should show in-stock status badge for IN_STOCK', () => {
    component.product = makeProduct({ availability: 'IN_STOCK' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('In stock');
  });

  it('should show fallback when images is empty', () => {
    component.product = makeProduct({ images: [] });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.product-image-fallback')).toBeTruthy();
    expect(el.querySelector('.product-image')).toBeFalsy();
  });

  it('should show fallback on image error', () => {
    component.product = makeProduct({ images: ['https://broken.example.com/img.jpg'] });
    component.imageError = true;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.product-image-fallback')).toBeTruthy();
  });

  it('should not render model/mpn when both are null', () => {
    component.product = makeProduct({ model: null, mpn: null });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.product-identifiers')).toBeFalsy();
  });

  it('should render model when present', () => {
    component.product = makeProduct({ model: 'RTX 4090', mpn: null });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('RTX 4090');
  });

  it('should not render brand when null', () => {
    component.product = makeProduct({ brand: null });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    // brand element should not be present
    expect(el.querySelector('.product-brand')).toBeFalsy();
  });

  it('should not render source link when sourceUrl is null', () => {
    component.product = makeProduct({ sourceUrl: null });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.source-link')).toBeFalsy();
  });

  it('should render safe source link with noopener noreferrer', () => {
    component.product = makeProduct({ sourceUrl: 'https://sigma-computer.com/p/123' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector('.source-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
    expect(link.target).toBe('_blank');
  });

  it('should not infer or display bundle badge (no isBundle field)', () => {
    component.product = makeProduct({ title: '[Bundle] CPU + Motherboard' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.bundle-badge')).toBeFalsy();
  });

  it('should handle unknown availability gracefully', () => {
    component.product = makeProduct({ availability: 'UNKNOWN' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Availability unknown');
  });

  it('should have accessible title link to product detail', () => {
    component.product = makeProduct({ id: 'abc123', title: 'Core i7' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector('.product-title-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('/products/abc123');
  });
});
