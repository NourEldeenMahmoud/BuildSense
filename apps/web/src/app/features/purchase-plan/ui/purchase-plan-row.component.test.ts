import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PurchasePlanRowComponent } from './purchase-plan-row.component';
import type { PurchasePlanComponentRowViewModel } from '../purchase-plan-view.models';

function makeRow(overrides: Partial<PurchasePlanComponentRowViewModel> = {}): PurchasePlanComponentRowViewModel {
  return {
    slotDisplayName: 'CPU',
    productName: 'Test Product',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    ...overrides,
  };
}

describe('PurchasePlanRowComponent', () => {
  let fixture: ComponentFixture<PurchasePlanRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchasePlanRowComponent],
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
    const avail = fixture.nativeElement.querySelector('.availability-value');
    expect(avail?.textContent?.trim()).toBe('Unavailable');
  });

  it('row has role="row"', () => {
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('.review-row');
    expect(row?.getAttribute('role')).toBe('row');
  });

  it('cells have role="cell"', () => {
    fixture.detectChanges();
    const cells = fixture.nativeElement.querySelectorAll('[role="cell"]');
    expect(cells).toHaveLength(4);
  });

  it('renders different slot names correctly', () => {
    fixture.componentInstance.row = makeRow({ slotDisplayName: 'GPU' });
    fixture.detectChanges();
    const slot = fixture.nativeElement.querySelector('.slot-name');
    expect(slot?.textContent?.trim()).toBe('GPU');
  });

  it('does not contain active behavior claims', () => {
    fixture.detectChanges();
    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('Remove');
    expect(html).not.toContain('Replace');
    expect(html).not.toContain('Compatible');
  });
});
