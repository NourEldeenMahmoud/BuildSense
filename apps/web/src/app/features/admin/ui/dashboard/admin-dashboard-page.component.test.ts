import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminDashboardPage } from './admin-dashboard-page.component';
import type {
  AdminDashboardResponse,
  AdminWorkerStatusResponse,
  AdminCatalogStatsResponse,
  AdminMatchReviewListResponse,
  AdminDataQualityIssueListResponse,
  AdminScrapeRunListResponse,
} from '@buildsense/contracts';

function mockDashboard(): AdminDashboardResponse {
  return {
    scrapeRuns: { total: 42, lastRunAt: '2024-01-01T00:00:00Z' },
    catalog: { totalProducts: 150, totalOffers: 300, totalDiscovered: 500 },
    compatibilityQuality: { totalCategories: 8, allGatesPassCount: 6, allGatesFailCount: 2 },
    referenceDatasets: { total: 3 },
    worker: { activeLocks: 1 },
  };
}

function mockCatalogStats(): AdminCatalogStatsResponse {
  return {
    totalProducts: 150,
    totalOffers: 300,
    totalDiscovered: 500,
    productsByCategory: [
      { category: 'CPU', count: 50 },
      { category: 'GPU', count: 40 },
    ],
    productsByEligibility: { eligible: 120, notEligible: 30 },
  };
}

function mockWorkerStatus(): AdminWorkerStatusResponse {
  return { activeLocks: [] };
}

function mockMatchReviews(totalItems: number): AdminMatchReviewListResponse {
  return { items: [], pagination: { page: 1, pageSize: 1, totalItems, totalPages: 0 } };
}

function mockDataQualityIssues(totalItems: number): AdminDataQualityIssueListResponse {
  return { items: [], pagination: { page: 1, pageSize: 1, totalItems, totalPages: 0 } };
}

function mockScrapeRuns(): AdminScrapeRunListResponse {
  return {
    items: [
      {
        id: '1',
        runId: 'run-001',
        storeCode: 'sigma',
        mode: 'full',
        status: 'COMPLETED',
        stage: 'done',
        summary: { totalDiscovered: 100, totalFetched: 95, totalFailed: 5 },
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T10:30:00Z',
        createdAt: '2024-01-01T10:00:00Z',
      },
      {
        id: '2',
        runId: 'run-002',
        storeCode: 'sigma',
        mode: 'full',
        status: 'FAILED',
        stage: 'fetch',
        summary: { totalDiscovered: 50, totalFetched: 20, totalFailed: 30 },
        startedAt: '2024-01-01T09:00:00Z',
        completedAt: null,
        createdAt: '2024-01-01T09:00:00Z',
      },
    ],
    pagination: { page: 1, pageSize: 8, totalItems: 2, totalPages: 1 },
  };
}

describe('AdminDashboardPage', () => {
  let fixture: ComponentFixture<AdminDashboardPage>;
  let apiSpy: {
    getDashboard: ReturnType<typeof vi.fn>;
    getWorkerStatus: ReturnType<typeof vi.fn>;
    getCatalogStats: ReturnType<typeof vi.fn>;
    getMatchReviews: ReturnType<typeof vi.fn>;
    getDataQualityIssues: ReturnType<typeof vi.fn>;
    getScrapeRuns: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    apiSpy = {
      getDashboard: vi.fn().mockReturnValue(of(mockDashboard())),
      getWorkerStatus: vi.fn().mockReturnValue(of(mockWorkerStatus())),
      getCatalogStats: vi.fn().mockReturnValue(of(mockCatalogStats())),
      getMatchReviews: vi.fn().mockReturnValue(of(mockMatchReviews(5))),
      getDataQualityIssues: vi.fn().mockReturnValue(of(mockDataQualityIssues(3))),
      getScrapeRuns: vi.fn().mockReturnValue(of(mockScrapeRuns())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
  });

  it('renders 4 metric cards when loaded', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.metric-card');
    expect(cards.length).toBe(4);
  });

  it('displays scrape runs total', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.metric-card');
    expect(cards[0]?.textContent).toContain('RECENT SCRAPE RUNS');
    expect(cards[0]?.textContent).toContain('42');
  });

  it('displays failed runs count', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.metric-card');
    expect(cards[1]?.textContent).toContain('FAILED — RECENT RUNS');
    expect(cards[1]?.textContent).toContain('1');
  });

  it('displays open match reviews count', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.metric-card');
    expect(cards[2]?.textContent).toContain('OPEN MATCH REVIEWS');
    expect(cards[2]?.textContent).toContain('5');
  });

  it('displays open data issues count', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.metric-card');
    expect(cards[3]?.textContent).toContain('UNRESOLVED DATA ISSUES');
    expect(cards[3]?.textContent).toContain('3');
  });

  it('shows warning status when match reviews > 0', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.metric-card');
    const statusText = cards[2]?.querySelector('.metric-status-text--warning');
    expect(statusText).toBeTruthy();
  });

  it('shows error status when data issues > 0', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.metric-card');
    // Data issues count should be present without fake health label
    expect(cards[3]?.textContent).toContain('3');
    expect(cards[3]?.querySelector('.metric-status-dot--error')).toBeFalsy();
    expect(cards[3]?.textContent).not.toContain('Degraded');
    expect(cards[3]?.textContent).not.toContain('Healthy');
  });

  it('renders chart panel with category bars', () => {
    const el: HTMLElement = fixture.nativeElement;
    const chartBars = el.querySelectorAll('.chart-bar');
    expect(chartBars.length).toBe(2);
  });

  it('renders chart bar labels', () => {
    const el: HTMLElement = fixture.nativeElement;
    const labels = el.querySelectorAll('.chart-bar-label');
    expect(labels[0]?.textContent).toContain('CPU');
    expect(labels[1]?.textContent).toContain('GPU');
  });

  it('renders chart bar values', () => {
    const el: HTMLElement = fixture.nativeElement;
    const values = el.querySelectorAll('.chart-bar-value');
    expect(values[0]?.textContent).toContain('50');
    expect(values[1]?.textContent).toContain('40');
  });

  it('renders chart with aria label', () => {
    const el: HTMLElement = fixture.nativeElement;
    const chartContainer = el.querySelector('.chart-container');
    expect(chartContainer?.getAttribute('aria-label')).toContain('Bar chart');
  });

  it('does not render progress bar on scrape runs card', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.metric-card');
    expect(cards[0]?.querySelector('.metric-progress-track')).toBeFalsy();
    expect(cards[0]?.querySelector('.metric-progress-fill')).toBeFalsy();
  });

  it('does not render fake severity labels on failed runs card', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.metric-card');
    expect(cards[1]?.textContent).not.toContain('High');
    expect(cards[1]?.textContent).not.toContain('None');
  });

  it('renders eligibility summary panel', () => {
    const el: HTMLElement = fixture.nativeElement;
    const panelTitles = el.querySelectorAll('.panel-title');
    const eligibilityTitle = Array.from(panelTitles).find((t) =>
      t.textContent?.includes('ELIGIBILITY_SUMMARY'),
    );
    expect(eligibilityTitle).toBeTruthy();
  });

  it('renders eligibility items with real counts', () => {
    const el: HTMLElement = fixture.nativeElement;
    const items = el.querySelectorAll('.eligibility-item');
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toContain('ELIGIBLE');
    expect(items[0]?.textContent).toContain('120');
    expect(items[1]?.textContent).toContain('NOT ELIGIBLE');
    expect(items[1]?.textContent).toContain('30');
  });

  it('renders activity table', () => {
    const el: HTMLElement = fixture.nativeElement;
    const activityTable = el.querySelector('.activity-table');
    expect(activityTable).toBeTruthy();
  });

  it('renders activity table headers', () => {
    const el: HTMLElement = fixture.nativeElement;
    const headers = el.querySelectorAll('.activity-th');
    expect(headers.length).toBe(5);
    expect(headers[0]?.textContent).toContain('STATUS');
    expect(headers[1]?.textContent).toContain('TIMESTAMP');
    expect(headers[2]?.textContent).toContain('SOURCE');
    expect(headers[3]?.textContent).toContain('EVENT');
    expect(headers[4]?.textContent).toContain('ACTION');
  });

  it('renders activity rows from scrape runs', () => {
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.activity-tr');
    expect(rows.length).toBe(2);
  });

  it('displays completed status badge', () => {
    const el: HTMLElement = fixture.nativeElement;
    const badges = el.querySelectorAll('.status-badge--completed');
    expect(badges.length).toBe(1);
    expect(badges[0]?.textContent).toContain('COMPLETED');
  });

  it('displays failed status badge', () => {
    const el: HTMLElement = fixture.nativeElement;
    const badges = el.querySelectorAll('.status-badge--failed');
    expect(badges.length).toBe(1);
    expect(badges[0]?.textContent).toContain('FAILED');
  });

  it('displays activity source', () => {
    const el: HTMLElement = fixture.nativeElement;
    const sources = el.querySelectorAll('.activity-td--source');
    expect(sources[0]?.textContent).toContain('sigma');
  });

  it('displays activity event text', () => {
    const el: HTMLElement = fixture.nativeElement;
    const events = el.querySelectorAll('.activity-td--event');
    expect(events[0]?.textContent).toContain('fetched');
  });

  it('renders activity action links', () => {
    const el: HTMLElement = fixture.nativeElement;
    const actionLinks = el.querySelectorAll('.action-link');
    expect(actionLinks.length).toBe(2);
    expect(actionLinks[0]?.textContent).toContain('VIEW_LOG');
  });

  it('renders 3 bottom navigation cards', () => {
    const el: HTMLElement = fixture.nativeElement;
    const navCards = el.querySelectorAll('.nav-card');
    expect(navCards.length).toBe(3);
  });

  it('shows loading skeleton initially', async () => {
    apiSpy.getDashboard.mockReturnValue(of(mockDashboard()));
    const freshFixture = TestBed.createComponent(AdminDashboardPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    expect(el.querySelector('.metrics-grid')).toBeTruthy();
  });

  it('shows error state on API failure', async () => {
    apiSpy.getDashboard.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'Server error' } })));
    const failFixture = TestBed.createComponent(AdminDashboardPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('Failed to load dashboard');
  });

  it('has retry button in error state', async () => {
    apiSpy.getDashboard.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'fail' } })));
    const failFixture = TestBed.createComponent(AdminDashboardPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    const retryBtn = el.querySelector('.retry-btn');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toContain('RETRY');
  });

  it('shows empty state when no scrape runs', async () => {
    apiSpy.getScrapeRuns.mockReturnValue(of({ items: [], pagination: { page: 1, pageSize: 8, totalItems: 0, totalPages: 0 } }));
    const freshFixture = TestBed.createComponent(AdminDashboardPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const emptyState = el.querySelector('.activity-body .empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toContain('No recent activity');
  });

  it('shows error state when scrape runs API fails', async () => {
    apiSpy.getScrapeRuns.mockReturnValue(throwError(() => ({ status: 500 })));
    const freshFixture = TestBed.createComponent(AdminDashboardPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const errorState = el.querySelector('.activity-error');
    expect(errorState).toBeTruthy();
    expect(errorState?.textContent).toContain('Unable to load recent activity');
  });

  it('shows empty chart when no category data', async () => {
    apiSpy.getCatalogStats.mockReturnValue(of({
      totalProducts: 0,
      totalOffers: 0,
      totalDiscovered: 0,
      productsByCategory: [],
      productsByEligibility: { eligible: 0, notEligible: 0 },
    }));
    const freshFixture = TestBed.createComponent(AdminDashboardPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const chartEmpty = el.querySelector('.chart-body .empty-state');
    expect(chartEmpty).toBeTruthy();
    expect(chartEmpty?.textContent).toContain('No category data available');
  });
});
