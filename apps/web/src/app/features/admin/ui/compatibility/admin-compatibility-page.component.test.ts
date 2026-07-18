import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError, Observable } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminCompatibilityPage } from './admin-compatibility-page.component';
import type { AdminCompatibilityQualityResponse } from '@buildsense/contracts';

function mockCompatibilityQuality(): AdminCompatibilityQualityResponse {
  return {
    items: [
      {
        category: 'CPU',
        extractorVersion: 'cpu-extractor-v2',
        totalProducts: 150,
        allGatesPass: true,
        evaluatedAt: '2024-06-15T10:00:00Z',
        factMetrics: [
          { factKey: 'socket', extractableCount: 148, coverage: 0.987, verifiedCorrect: 120, verifiedSampleSize: 125, precision: 0.96 },
          { factKey: 'tdp_watts', extractableCount: 140, coverage: 0.933, verifiedCorrect: null, verifiedSampleSize: null, precision: null },
        ],
      },
      {
        category: 'GPU',
        extractorVersion: 'gpu-extractor-v1',
        totalProducts: 200,
        allGatesPass: false,
        evaluatedAt: '2024-06-14T09:00:00Z',
        factMetrics: [
          { factKey: 'vram_gb', extractableCount: 180, coverage: 0.9, verifiedCorrect: 170, verifiedSampleSize: 180, precision: 0.944 },
          { factKey: 'base_clock_mhz', extractableCount: 80, coverage: 0.4, verifiedCorrect: null, verifiedSampleSize: null, precision: null },
        ],
      },
    ],
  };
}

describe('AdminCompatibilityPage', () => {
  let fixture: ComponentFixture<AdminCompatibilityPage>;
  let apiSpy: { getCompatibilityQuality: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      getCompatibilityQuality: vi.fn().mockReturnValue(of(mockCompatibilityQuality())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminCompatibilityPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCompatibilityPage);
    fixture.detectChanges();
  });

  it('renders page intro text', () => {
    const el: HTMLElement = fixture.nativeElement;
    const intro = el.querySelector('.page-intro-text');
    expect(intro).toBeTruthy();
    expect(intro?.textContent).toContain('Fact extraction coverage');
  });

  it('renders summary bar with counts', () => {
    const el: HTMLElement = fixture.nativeElement;
    const summaryItems = el.querySelectorAll('.summary-item');
    expect(summaryItems.length).toBe(3);
    const labels = Array.from(summaryItems).map(s => s.querySelector('.summary-label')?.textContent?.trim());
    expect(labels).toContain('CATEGORIES');
    expect(labels).toContain('ALL PASS');
    expect(labels).toContain('GATES FAIL');
  });

  it('displays correct pass/fail counts', () => {
    const el: HTMLElement = fixture.nativeElement;
    const values = el.querySelectorAll('.summary-value');
    const valueTexts = Array.from(values).map(v => v.textContent?.trim());
    expect(valueTexts).toContain('2');  // total categories
    expect(valueTexts).toContain('1');  // 1 pass, 1 fail
  });

  it('renders category cards', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.quality-card');
    expect(cards.length).toBe(2);
  });

  it('renders category names', () => {
    const el: HTMLElement = fixture.nativeElement;
    const categories = el.querySelectorAll('.card-category');
    const names = Array.from(categories).map(c => c.textContent?.trim());
    expect(names).toContain('CPU');
    expect(names).toContain('GPU');
  });

  it('renders gate badges with correct classes', () => {
    const el: HTMLElement = fixture.nativeElement;
    const badges = el.querySelectorAll('.gate-badge');
    expect(badges.length).toBe(2);
    const texts = Array.from(badges).map(b => b.textContent?.trim());
    expect(texts).toContain('ALL GATES PASS');
    expect(texts).toContain('GATES FAIL');
  });

  it('marks failing card with fail border', () => {
    const el: HTMLElement = fixture.nativeElement;
    const failCard = el.querySelectorAll('.quality-card--fail');
    expect(failCard.length).toBe(1);
  });

  it('renders extractor version, product count, fact count, evaluated date', () => {
    const el: HTMLElement = fixture.nativeElement;
    const metaValues = el.querySelectorAll('.meta-value');
    const texts = Array.from(metaValues).map(m => m.textContent?.trim());
    expect(texts).toContain('cpu-extractor-v2');
    expect(texts).toContain('gpu-extractor-v1');
    expect(texts.some(t => t?.includes('150'))).toBe(true);
    expect(texts.some(t => t?.includes('200'))).toBe(true);
  });

  it('renders fact metrics tables with headers', () => {
    const el: HTMLElement = fixture.nativeElement;
    const tables = el.querySelectorAll('.data-table');
    expect(tables.length).toBe(2);
    const headers = el.querySelectorAll('.data-th');
    const headerTexts = Array.from(headers).map(h => h.textContent?.trim());
    expect(headerTexts).toContain('FACT KEY');
    expect(headerTexts).toContain('EXTRACTABLE');
    expect(headerTexts).toContain('COVERAGE');
    expect(headerTexts).toContain('PRECISION');
    expect(headerTexts).toContain('VERIFIED');
  });

  it('renders fact key values', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cells = el.querySelectorAll('.data-td');
    const cellTexts = Array.from(cells).map(c => c.textContent?.trim() ?? '');
    expect(cellTexts).toContain('socket');
    expect(cellTexts).toContain('tdp_watts');
    expect(cellTexts).toContain('vram_gb');
    expect(cellTexts).toContain('base_clock_mhz');
  });

  it('renders coverage percentages', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('98.7%');
    expect(el.textContent).toContain('93.3%');
    expect(el.textContent).toContain('90.0%');
    expect(el.textContent).toContain('40.0%');
  });

  it('renders verified counts for facts with verification data', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('120/125');
    expect(el.textContent).toContain('170/180');
  });

  it('renders dash for null precision and null verified', () => {
    const el: HTMLElement = fixture.nativeElement;
    const dimSpans = el.querySelectorAll('.text-dim');
    expect(dimSpans.length).toBeGreaterThan(0);
  });

  it('applies color classes based on coverage thresholds', () => {
    const el: HTMLElement = fixture.nativeElement;
    const primarySpans = el.querySelectorAll('.text-primary');
    expect(primarySpans.length).toBeGreaterThan(0);  // 98.7%, 93.3%, 90.0%, 94.4%
    const errorSpans = el.querySelectorAll('.text-error');
    expect(errorSpans.length).toBe(1);  // 40.0%
  });

  it('calls getCompatibilityQuality on init', () => {
    expect(apiSpy.getCompatibilityQuality).toHaveBeenCalled();
  });

  it('shows loading skeleton before data arrives', async () => {
    // Use a deferred observable so loading state is visible
    let resolve!: (value: AdminCompatibilityQualityResponse) => void;
    const deferred = new Promise<AdminCompatibilityQualityResponse>(r => { resolve = r; });
    apiSpy.getCompatibilityQuality.mockReturnValue(new Observable(sub => {
      deferred.then(v => { sub.next(v); sub.complete(); });
    }));
    const fresh = TestBed.createComponent(AdminCompatibilityPage);
    fresh.detectChanges();
    const el: HTMLElement = fresh.nativeElement;
    expect(el.querySelector('.skeleton-panel')).toBeTruthy();
    resolve(mockCompatibilityQuality());
  });

  it('shows error state on API failure', async () => {
    apiSpy.getCompatibilityQuality.mockReturnValue(
      throwError(() => ({ status: 500, error: { error: 'Server error' } }))
    );
    const failFixture = TestBed.createComponent(AdminCompatibilityPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('REQUEST_FAILED');
  });

  it('has retry button in error state', async () => {
    apiSpy.getCompatibilityQuality.mockReturnValue(
      throwError(() => ({ status: 500, error: { error: 'fail' } }))
    );
    const failFixture = TestBed.createComponent(AdminCompatibilityPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    const retryBtn = el.querySelector('.retry-btn');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toContain('RETRY');
  });

  it('shows empty state when no categories', async () => {
    apiSpy.getCompatibilityQuality.mockReturnValue(of({ items: [] }));
    const fresh = TestBed.createComponent(AdminCompatibilityPage);
    fresh.detectChanges();
    const el: HTMLElement = fresh.nativeElement;
    const emptyPanel = el.querySelector('.empty-panel');
    expect(emptyPanel).toBeTruthy();
    expect(emptyPanel?.textContent).toContain('NO COMPATIBILITY DATA');
  });

  it('does not render fake scores, percentages, trends, or charts', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Health Score');
    expect(el.textContent).not.toContain('Trend');
    expect(el.textContent).not.toContain('Chart');
    expect(el.textContent).not.toContain('Overall Score');
    expect(el.textContent).not.toContain('Grade');
  });
});
