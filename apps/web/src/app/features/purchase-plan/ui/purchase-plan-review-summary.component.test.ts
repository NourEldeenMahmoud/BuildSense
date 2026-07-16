import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PurchasePlanReviewSummaryComponent } from './purchase-plan-review-summary.component';
import type { PurchasePlanPageViewModel } from '../purchase-plan-view.models';

function makeVm(overrides: Partial<PurchasePlanPageViewModel> = {}): PurchasePlanPageViewModel {
  return {
    hasBuild: false,
    buildPublicId: null,
    buildStatusLabel: null,
    componentCount: 0,
    componentTarget: 7,
    productsScannedLabel: null,
    totalPriceLabel: null,
    compatibilityStatusLabel: null,
    compatibilityStatus: null,
    compatibilityHeading: null,
    compatibilityDescription: null,
    componentRows: [],
    ...overrides,
  };
}

function queryButtons(fixture: ComponentFixture<PurchasePlanReviewSummaryComponent>): HTMLButtonElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  ) as HTMLButtonElement[];
}

describe('PurchasePlanReviewSummaryComponent', () => {
  let fixture: ComponentFixture<PurchasePlanReviewSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchasePlanReviewSummaryComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PurchasePlanReviewSummaryComponent);
    fixture.componentInstance.vm = makeVm();
  });

  describe('empty state', () => {
    it('renders the summary heading', () => {
      fixture.detectChanges();
      const heading = fixture.nativeElement.querySelector('.summary-heading');
      expect(heading?.textContent?.trim()).toBe('Build Summary');
    });

    it('displays component count', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[0];
      expect(value?.textContent?.trim()).toBe('0 / 7');
    });

    it('displays "Not available" for total price', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelector('.total-value');
      expect(value?.textContent?.trim()).toBe('Not available');
    });

    it('does not fabricate a products scanned count', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[1];
      expect(value?.textContent?.trim()).toBe('Not reported');
    });

    it('shows disclaimer text', () => {
      fixture.detectChanges();
      const disclaimer = fixture.nativeElement.querySelector('.disclaimer-text');
      expect(disclaimer?.textContent).toContain('Prices and availability may change');
    });

    it('shows Print action', () => {
      fixture.detectChanges();
      const buttons = queryButtons(fixture);
      const printBtn = buttons.find((btn) => btn.textContent?.includes('Print'));
      expect(printBtn).toBeTruthy();
      expect(printBtn!.disabled).toBe(false);
    });

    it('shows Export Plan action', () => {
      fixture.detectChanges();
      const buttons = queryButtons(fixture);
      const exportBtn = buttons.find((btn) => btn.textContent?.includes('Export Plan'));
      expect(exportBtn).toBeTruthy();
      expect(exportBtn!.disabled).toBe(false);
    });

    it('shows PDF action', () => {
      fixture.detectChanges();
      const buttons = queryButtons(fixture);
      expect(buttons.some((btn) => btn.textContent?.includes('PDF'))).toBe(true);
    });

    it('summary has aria-label', () => {
      fixture.detectChanges();
      const panel = fixture.nativeElement.querySelector('.review-summary');
      expect(panel?.getAttribute('aria-label')).toBe('Build summary');
    });
  });

  describe('filled state', () => {
    beforeEach(() => {
      fixture.componentInstance.vm = makeVm({
        hasBuild: true,
        componentCount: 7,
        totalPriceLabel: '—',
        compatibilityStatusLabel: '—',
      });
    });

    it('displays filled component count', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[0];
      expect(value?.textContent?.trim()).toBe('7 / 7');
    });

    it('displays provided total price label', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelector('.total-value');
      expect(value?.textContent?.trim()).toBe('—');
    });

    it('displays a provided products scanned label', () => {
      fixture.componentInstance.vm = makeVm({ productsScannedLabel: '144' });
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[1];
      expect(value?.textContent?.trim()).toBe('144');
    });

    it('document actions remain available when filled', () => {
      fixture.detectChanges();
      const buttons = queryButtons(fixture);
      for (const btn of buttons) {
        expect(btn.disabled).toBe(false);
      }
    });
  });
});
