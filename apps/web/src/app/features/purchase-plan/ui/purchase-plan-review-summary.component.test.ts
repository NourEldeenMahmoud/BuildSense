import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PurchasePlanReviewSummaryComponent } from './purchase-plan-review-summary.component';
import type { PurchasePlanPageViewModel } from '../purchase-plan-view.models';

function makeVm(overrides: Partial<PurchasePlanPageViewModel> = {}): PurchasePlanPageViewModel {
  return {
    hasBuild: false,
    componentCount: 0,
    totalPriceLabel: null,
    compatibilityStatusLabel: null,
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
      expect(heading?.textContent?.trim()).toBe('Review Summary');
    });

    it('displays component count', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[0];
      expect(value?.textContent?.trim()).toBe('0 / 7');
    });

    it('displays "Not available" for total price', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[1];
      expect(value?.textContent?.trim()).toBe('Not available');
    });

    it('displays "Deferred" for compatibility', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[2];
      expect(value?.textContent?.trim()).toBe('Deferred');
    });

    it('shows disclaimer text', () => {
      fixture.detectChanges();
      const disclaimer = fixture.nativeElement.querySelector('.disclaimer-text');
      expect(disclaimer?.textContent).toContain('display-only estimates');
    });

    it('Print Plan button is disabled', () => {
      fixture.detectChanges();
      const buttons = queryButtons(fixture);
      const printBtn = buttons.find((btn) =>
        btn.getAttribute('aria-label')?.includes('Print plan'),
      );
      expect(printBtn).toBeTruthy();
      expect(printBtn!.disabled).toBe(true);
    });

    it('Export Plan button is disabled', () => {
      fixture.detectChanges();
      const buttons = queryButtons(fixture);
      const exportBtn = buttons.find((btn) =>
        btn.getAttribute('aria-label')?.includes('Export plan'),
      );
      expect(exportBtn).toBeTruthy();
      expect(exportBtn!.disabled).toBe(true);
    });

    it('explains why Print Plan is disabled', () => {
      fixture.detectChanges();
      const reasons = fixture.nativeElement.querySelectorAll('.action-reason');
      expect(reasons[0]?.textContent?.trim()).toContain('Available later');
    });

    it('explains why Export Plan is disabled', () => {
      fixture.detectChanges();
      const reasons = fixture.nativeElement.querySelectorAll('.action-reason');
      expect(reasons[1]?.textContent?.trim()).toContain('Available later');
    });

    it('summary has aria-label', () => {
      fixture.detectChanges();
      const panel = fixture.nativeElement.querySelector('.review-summary');
      expect(panel?.getAttribute('aria-label')).toBe('Purchase review summary');
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
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[1];
      expect(value?.textContent?.trim()).toBe('—');
    });

    it('displays provided compatibility label', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[2];
      expect(value?.textContent?.trim()).toBe('—');
    });

    it('buttons remain disabled even when filled', () => {
      fixture.detectChanges();
      const buttons = queryButtons(fixture);
      for (const btn of buttons) {
        expect(btn.disabled).toBe(true);
      }
    });
  });
});
