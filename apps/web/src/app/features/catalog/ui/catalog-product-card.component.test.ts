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
  cardSpecifications: [],
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

  // ── Core rendering ─────────────────────────────────────

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

  it('should not render brand when null', () => {
    component.product = makeProduct({ brand: null });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.product-brand')).toBeFalsy();
  });

  it('should not render external link when sourceUrl is null', () => {
    component.product = makeProduct({ sourceUrl: null });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.hover-btn-external')).toBeFalsy();
  });

  it('should render safe external link with noopener noreferrer', () => {
    component.product = makeProduct({ sourceUrl: 'https://sigma-computer.com/p/123' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector('.hover-btn-external') as HTMLAnchorElement;
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

  it('makes the full card an accessible product detail link', () => {
    component.product = makeProduct({ id: 'abc123', title: 'Core i7' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector('.card-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('/products/abc123');
    expect(link.getAttribute('aria-label')).toBe('View Core i7');
  });

  // ── Specification rows ─────────────────────────────────

  it('shows at most two useful category specifications with readable labels', () => {
    component.product = makeProduct({
      cardSpecifications: [
        { label: 'cpu_socket', value: 'AM5' },
        { label: 'Cores', value: '8' },
        { label: 'Threads', value: '16' },
      ]
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.spec-row');
    expect(rows.length).toBe(2);
    expect(Array.from(el.querySelectorAll('.spec-label')).map((node) => node.textContent?.trim()))
      .toEqual(['Socket', 'Cores']);
  });

  it('shows one meaningful specification when only one exists', () => {
    component.product = makeProduct({
      category: 'PSU',
      cardSpecifications: [{ label: 'Rated Power', value: '750W' }]
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.spec-row');
    expect(rows.length).toBe(1);
  });

  it('hides technical identifiers and unsupported raw metadata', () => {
    component.product = makeProduct({
      cardSpecifications: [
        { label: 'MPN', value: 'TUF-RTX4090-O24G' },
        { label: 'internal_id', value: 'abc123' },
      ],
      model: 'RTX 4090',
      mpn: 'TUF-RTX4090-O24G',
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.spec-table')).toBeFalsy();
    expect(el.textContent).not.toContain('TUF-RTX4090-O24G');
    expect(el.textContent).not.toContain('abc123');
  });

  it('hides the spec table when no specification, model, or MPN exists', () => {
    component.product = makeProduct({ model: null, mpn: null });
    delete component.product.cardSpecifications;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.spec-table')).toBeFalsy();
  });

  it('displays a friendly specification label and its value', () => {
    component.product = makeProduct({
      category: 'COOLING',
      cardSpecifications: [{ label: 'Type', value: 'AIO Liquid Cooler' }]
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const label = el.querySelector('.spec-label');
    const value = el.querySelector('.spec-value');
    expect(label?.textContent?.trim()).toBe('Cooler Type');
    expect(value?.textContent?.trim()).toBe('AIO Liquid Cooler');
  });

  // ── Category display correction ────────────────────────

  it('should display COOLING for MONITOR category with cooling title signal', () => {
    component.product = makeProduct({
      category: 'MONITOR',
      title: 'Cooler Master MasterLiquid 240 AIO',
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.product-category')?.textContent?.trim()).toBe('COOLING');
  });

  it('should display COOLING for MONITOR category with model containing cooler', () => {
    component.product = makeProduct({
      category: 'MONITOR',
      title: 'Some Product',
      model: 'NZXT Kraken X63 Liquid Cooling',
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.product-category')?.textContent?.trim()).toBe('COOLING');
  });

  it('should NOT correct category for MONITOR without cooling signals', () => {
    component.product = makeProduct({
      category: 'MONITOR',
      title: 'Samsung Odyssey G7 27"',
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.product-category')?.textContent?.trim()).toBe('MONITOR');
  });

  it('should NOT correct category for non-MONITOR categories', () => {
    component.product = makeProduct({
      category: 'CPU',
      title: 'Intel Core i7-13700K Desktop Processor with Wraith Cooler',
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.product-category')?.textContent?.trim()).toBe('CPU');
  });

  it('should display the original category for GPU', () => {
    component.product = makeProduct({ category: 'GPU', title: 'RTX 4090' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.product-category')?.textContent?.trim()).toBe('GPU');
  });

  // ── Brand rendering ────────────────────────────────────

  it('should render brand when present', () => {
    component.product = makeProduct({ brand: 'AMD' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const brand = el.querySelector('.product-brand');
    expect(brand).toBeTruthy();
    expect(brand?.textContent?.trim()).toBe('AMD');
  });
});
