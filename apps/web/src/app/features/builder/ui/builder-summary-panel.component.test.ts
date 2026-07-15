import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { BuilderSummaryPanelComponent } from './builder-summary-panel.component';
import type { BuilderSummaryViewModel } from '../builder-view.models';

function makeSummary(overrides: Partial<BuilderSummaryViewModel> = {}): BuilderSummaryViewModel {
  return {
    slotCount: 7,
    filledCount: 0,
    totalEstimateLabel: null,
    compatibilityStatusLabel: null,
    ...overrides,
  };
}

function queryButtons(fixture: ComponentFixture<BuilderSummaryPanelComponent>): HTMLButtonElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  ) as HTMLButtonElement[];
}

describe('BuilderSummaryPanelComponent', () => {
  let fixture: ComponentFixture<BuilderSummaryPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuilderSummaryPanelComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BuilderSummaryPanelComponent);
    fixture.componentInstance.summary = makeSummary();
  });

  describe('empty state', () => {
    it('renders the summary heading', () => {
      fixture.detectChanges();
      const heading = fixture.nativeElement.querySelector('.summary-heading');
      expect(heading?.textContent?.trim()).toBe('Build Summary');
    });

    it('displays component count as filled / total', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[0];
      expect(value?.textContent?.trim()).toBe('0 / 7');
    });

    it('displays "Not available" for estimated total', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[1];
      expect(value?.textContent?.trim()).toBe('Not available');
    });

    it('displays "Deferred" for compatibility', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[2];
      expect(value?.textContent?.trim()).toBe('Deferred');
    });

    it('renders Save Build button as disabled', () => {
      fixture.detectChanges();
      const buttons = queryButtons(fixture);
      const saveBtn = buttons.find((btn) =>
        btn.getAttribute('aria-label')?.includes('Save build'),
      );
      expect(saveBtn).toBeTruthy();
      expect(saveBtn!.disabled).toBe(true);
    });

    it('renders Review & Purchase button as disabled', () => {
      fixture.detectChanges();
      const buttons = queryButtons(fixture);
      const reviewBtn = buttons.find((btn) =>
        btn.getAttribute('aria-label')?.includes('Review build'),
      );
      expect(reviewBtn).toBeTruthy();
      expect(reviewBtn!.disabled).toBe(true);
    });

    it('explains why Save Build is disabled', () => {
      fixture.detectChanges();
      const reasons = fixture.nativeElement.querySelectorAll('.action-reason');
      expect(reasons[0]?.textContent?.trim()).toContain('Available later');
    });

    it('explains why Review & Purchase is disabled', () => {
      fixture.detectChanges();
      const reasons = fixture.nativeElement.querySelectorAll('.action-reason');
      expect(reasons[1]?.textContent?.trim()).toContain('Requires completed components');
    });

    it('panel has aria-label "Build summary"', () => {
      fixture.detectChanges();
      const panel = fixture.nativeElement.querySelector('.summary-panel');
      expect(panel?.getAttribute('aria-label')).toBe('Build summary');
    });

    it('does not display compatibility results, prices, or totals', () => {
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toContain('Compatible');
      expect(html).not.toContain('Incompatible');
      expect(html).not.toContain('EGP');
    });
  });

  describe('filled state', () => {
    beforeEach(() => {
      fixture.componentInstance.summary = makeSummary({
        filledCount: 7,
        totalEstimateLabel: '—',
        compatibilityStatusLabel: '—',
      });
    });

    it('displays filled component count', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[0];
      expect(value?.textContent?.trim()).toBe('7 / 7');
    });

    it('displays provided total estimate label', () => {
      fixture.detectChanges();
      const value = fixture.nativeElement.querySelectorAll('.stat-value')[1];
      expect(value?.textContent?.trim()).toBe('—');
    });

    it('displays provided compatibility status label', () => {
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
