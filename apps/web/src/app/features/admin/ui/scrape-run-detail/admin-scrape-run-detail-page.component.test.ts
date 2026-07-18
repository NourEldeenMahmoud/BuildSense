import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminScrapeRunDetailPage } from './admin-scrape-run-detail-page.component';
import type { AdminScrapeRunDetailResponse } from '@buildsense/contracts';

function mockRunDetail(overrides?: Partial<AdminScrapeRunDetailResponse>): AdminScrapeRunDetailResponse {
  return {
    id: '1',
    runId: 'run-001',
    storeCode: 'sigma',
    mode: 'full',
    status: 'SUCCEEDED',
    stage: 'done',
    summary: {
      totalDiscovered: 100,
      totalFetched: 95,
      totalFailed: 5,
      totalMissingPrice: 2,
    },
    categoryAudit: [
      { seedId: 'cpu-seed', pagesProcessed: 12, productsDiscovered: 50, completed: true },
      { seedId: 'gpu-seed', pagesProcessed: 8, productsDiscovered: 30, completed: false, failureKind: 'NETWORK_ERROR' },
    ],
    startedAt: '2024-01-01T10:00:00Z',
    completedAt: '2024-01-01T10:30:00Z',
    createdAt: '2024-01-01T10:00:00Z',
    failures: [
      { canonicalUrl: 'https://example.com/product/1', fetchState: 'FAILED', failureKind: 'TIMEOUT', attempts: 3, categorySeedId: 'cpu-seed' },
    ],
    ...overrides,
  };
}

function mockActivatedRoute(runId: string): { snapshot: { paramMap: { get: (key: string) => string | null } } } {
  return {
    snapshot: {
      paramMap: {
        get: (key: string): string | null => (key === 'runId' ? runId : null),
      },
    },
  };
}

describe('AdminScrapeRunDetailPage', () => {
  let fixture: ComponentFixture<AdminScrapeRunDetailPage>;
  let apiSpy: { getScrapeRun: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      getScrapeRun: vi.fn().mockReturnValue(of(mockRunDetail())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminScrapeRunDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('run-001') },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminScrapeRunDetailPage);
    fixture.detectChanges();
  });

  it('reads runId from route param', () => {
    expect(apiSpy.getScrapeRun).toHaveBeenCalledWith('run-001');
  });

  it('renders back link to scrape runs', () => {
    const el: HTMLElement = fixture.nativeElement;
    const backLink = el.querySelector('.back-link');
    expect(backLink).toBeTruthy();
    expect(backLink?.textContent).toContain('SCRAPE RUNS');
  });

  it('renders summary strip with status badge', () => {
    const el: HTMLElement = fixture.nativeElement;
    const strip = el.querySelector('.summary-strip');
    expect(strip).toBeTruthy();
    const badge = strip?.querySelector('.status-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('SUCCEEDED');
  });

  it('renders run ID, store, mode, stage in summary', () => {
    const el: HTMLElement = fixture.nativeElement;
    const strip = el.querySelector('.summary-strip');
    expect(strip?.textContent).toContain('run-001');
    expect(strip?.textContent).toContain('sigma');
    expect(strip?.textContent).toContain('full');
    expect(strip?.textContent).toContain('done');
  });

  it('renders RUN_INFO panel with timestamps', () => {
    const el: HTMLElement = fixture.nativeElement;
    const panelTitles = el.querySelectorAll('.panel-title');
    const runInfoTitle = Array.from(panelTitles).find((t) =>
      t.textContent?.includes('RUN_INFO'),
    );
    expect(runInfoTitle).toBeTruthy();
  });

  it('displays summary counts in info grid', () => {
    const el: HTMLElement = fixture.nativeElement;
    const infoValues = el.querySelectorAll('.info-value');
    const texts = Array.from(infoValues).map((v) => v.textContent?.trim() ?? '');
    expect(texts).toContain('100'); // discovered
    expect(texts).toContain('95');  // fetched
    expect(texts).toContain('5');   // failed
  });

  it('displays missing price count when present', () => {
    const el: HTMLElement = fixture.nativeElement;
    const infoValues = el.querySelectorAll('.info-value');
    const texts = Array.from(infoValues).map((v) => v.textContent?.trim() ?? '');
    expect(texts).toContain('2'); // missing price
  });

  it('renders category audit table', () => {
    const el: HTMLElement = fixture.nativeElement;
    const panelTitles = el.querySelectorAll('.panel-title');
    const auditTitle = Array.from(panelTitles).find((t) =>
      t.textContent?.includes('CATEGORY_AUDIT'),
    );
    expect(auditTitle).toBeTruthy();
  });

  it('shows DONE badge for completed categories', () => {
    const el: HTMLElement = fixture.nativeElement;
    const okBadges = el.querySelectorAll('.mini-badge--ok');
    expect(okBadges.length).toBeGreaterThanOrEqual(1);
    expect(okBadges[0]?.textContent).toContain('DONE');
  });

  it('shows failure kind for incomplete categories', () => {
    const el: HTMLElement = fixture.nativeElement;
    const failBadges = el.querySelectorAll('.mini-badge--fail');
    expect(failBadges.length).toBeGreaterThanOrEqual(1);
    expect(failBadges[0]?.textContent).toContain('NETWORK_ERROR');
  });

  it('renders failures panel when failures exist', () => {
    const el: HTMLElement = fixture.nativeElement;
    const panelTitles = el.querySelectorAll('.panel-title');
    const failuresTitle = Array.from(panelTitles).find((t) =>
      t.textContent?.includes('FAILURES'),
    );
    expect(failuresTitle).toBeTruthy();
    expect(failuresTitle?.textContent).toContain('1 item(s)');
  });

  it('shows error state on API failure', async () => {
    apiSpy.getScrapeRun.mockReturnValue(throwError(() => ({ status: 404, error: { error: 'Not found' } })));
    const failFixture = TestBed.createComponent(AdminScrapeRunDetailPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('Failed to load scrape run');
  });

  it('renders empty category audit when null', async () => {
    apiSpy.getScrapeRun.mockReturnValue(of(mockRunDetail({ categoryAudit: null, failures: [] })));
    const freshFixture = TestBed.createComponent(AdminScrapeRunDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    expect(el.textContent).toContain('No category audit data');
  });

  it('hides failures panel when no failures', async () => {
    apiSpy.getScrapeRun.mockReturnValue(of(mockRunDetail({ failures: [] })));
    const freshFixture = TestBed.createComponent(AdminScrapeRunDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const panelTitles = el.querySelectorAll('.panel-title');
    const failuresTitle = Array.from(panelTitles).find((t) =>
      t.textContent?.includes('FAILURES'),
    );
    expect(failuresTitle).toBeFalsy();
  });

  it('displays failed count with error styling', () => {
    const el: HTMLElement = fixture.nativeElement;
    const errorValue = el.querySelector('.text-error');
    expect(errorValue).toBeTruthy();
    expect(errorValue?.textContent?.trim()).toBe('5');
  });

  it('shows retry button in error state', async () => {
    apiSpy.getScrapeRun.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'fail' } })));
    const failFixture = TestBed.createComponent(AdminScrapeRunDetailPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    const retryBtn = el.querySelector('.retry-btn');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toContain('RETRY');
  });
});
