import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PurchasePlanRowComponent } from './purchase-plan-row.component';
import type { PurchasePlanComponentRowViewModel } from '../purchase-plan-view.models';

function makeRow(overrides: Partial<PurchasePlanComponentRowViewModel> = {}): PurchasePlanComponentRowViewModel {
  return {
    slotKey: 'cpu',
    slotDisplayName: 'CPU',
    productId: 'test-product',
    productName: 'Test Product',
    imageUrl: null,
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    compatibilityStatus: 'UNKNOWN',
    compatibilityStatusLabel: 'Unknown',
    compatibilityReason: null,
    sourceUrl: '',
    ...overrides,
  };
}

describe('PurchasePlanRowComponent', () => {
  let fixture: ComponentFixture<PurchasePlanRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchasePlanRowComponent, RouterTestingModule],
    }).compileComponents();
    fixture = TestBed.createComponent(PurchasePlanRowComponent);
    fixture.componentInstance.row = makeRow();
  });

  it('renders the slot display name', () => {
    fixture.detectChanges();
    const slot = fixture.nativeElement.querySelector('.slot-name');
    expect(slot?.textContent?.trim()).toBe('CPU');
  });

  it('renders the product name', () => {
    fixture.detectChanges();
    const name = fixture.nativeElement.querySelector('.product-name');
    expect(name?.textContent?.trim()).toBe('Test Product');
  });

  it('renders the price label', () => {
    fixture.detectChanges();
    const price = fixture.nativeElement.querySelector('.price-value');
    expect(price?.textContent?.trim()).toBe('—');
  });

  it('renders the availability label', () => {
    fixture.detectChanges();
    const avail = fixture.nativeElement.querySelector('.availability');
    expect(avail?.textContent?.trim()).toBe('Unavailable');
  });

  it('renders as a component card', () => {
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('.review-row');
    expect(row?.tagName).toBe('ARTICLE');
  });

  it('renders different slot names correctly', () => {
    fixture.componentInstance.row = makeRow({ slotDisplayName: 'GPU' });
    fixture.detectChanges();
    const slot = fixture.nativeElement.querySelector('.slot-name');
    expect(slot?.textContent?.trim()).toBe('GPU');
  });

  it('shows compatibility and component actions', () => {
    fixture.detectChanges();
    const html = fixture.nativeElement.innerHTML;
    expect(html).toContain('Unknown');
    expect(html).toContain('Replace');
  });
});
