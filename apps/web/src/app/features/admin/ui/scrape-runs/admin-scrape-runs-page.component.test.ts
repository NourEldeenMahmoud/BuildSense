import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminScrapeRunsPage } from './admin-scrape-runs-page.component';
import type { AdminScrapeRunListResponse } from '@buildsense/contracts';

function mockScrapeRuns(extra?: { totalItems?: number; page?: number; pageSize?: number; totalPages?: number }): AdminScrapeRunListResponse {
  return {
    items: [
      {
        id: '1',
        runId: 'run-001',
        storeCode: 'sigma',
        mode: 'full',
        status: 'SUCCEEDED',
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
    pagination: {
      page: extra?.page ?? 1,
      pageSize: extra?.pageSize ?? 20,
      totalItems: extra?.totalItems ?? 2,
      totalPages: extra?.totalPages ?? 1,
    },
  };
}

describe('AdminScrapeRunsPage', () => {
  let fixture: ComponentFixture<AdminScrapeRunsPage>;
  let apiSpy: { getScrapeRuns: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      getScrapeRuns: vi.fn().mockReturnValue(of(mockScrapeRuns())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminScrapeRunsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminScrapeRunsPage);
    fixture.detectChanges();
  });

  it('renders filter bar with status dropdown', () => {
    const el: HTMLElement = fixture.nativeElement;
    const filterBar = el.querySelector('.filter-bar');
    expect(filterBar).toBeTruthy();
    const select = el.querySelector('.filter-select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['', 'CREATED', 'RUNNING', 'SUCCEEDED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED']);
  });

  it('displays total count in filter bar', () => {
    const el: HTMLElement = fixture.nativeElement;
    const count = el.querySelector('.filter-count');
    expect(count?.textContent).toContain('2 total');
  });

  it('renders data table with rows', () => {
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.data-tr');
    expect(rows.length).toBe(2);
  });

  it('renders status badges', () => {
    const el: HTMLElement = fixture.nativeElement;
    const badges = el.querySelectorAll('.status-badge');
    const badgeTexts = Array.from(badges).map((b) => b.textContent?.trim() ?? '');
    expect(badgeTexts).toContain('SUCCEEDED');
    expect(badgeTexts).toContain('FAILED');
  });

  it('renders run ID links', () => {
    const el: HTMLElement = fixture.nativeElement;
    const links = el.querySelectorAll('.run-link');
    expect(links.length).toBe(2);
    expect(links[0]?.textContent).toContain('run-00');
  });

  it('displays summary numbers', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cells = el.querySelectorAll('.data-td');
    const cellTexts = Array.from(cells).map((c) => c.textContent?.trim() ?? '');
    expect(cellTexts).toContain('100'); // discovered
    expect(cellTexts).toContain('95');  // fetched
    expect(cellTexts).toContain('5');   // failed
  });

  it('shows loading state', async () => {
    apiSpy.getScrapeRuns.mockReturnValue(of(mockScrapeRuns()));
    const freshFixture = TestBed.createComponent(AdminScrapeRunsPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    expect(el.querySelector('.data-table')).toBeTruthy();
  });

  it('shows error state on API failure', async () => {
    apiSpy.getScrapeRuns.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'Server error' } })));
    const failFixture = TestBed.createComponent(AdminScrapeRunsPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('Failed to load scrape runs');
  });

  it('has retry button in error state', async () => {
    apiSpy.getScrapeRuns.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'fail' } })));
    const failFixture = TestBed.createComponent(AdminScrapeRunsPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    const retryBtn = el.querySelector('.retry-btn');
    expect(retryBtn).toBeTruthy();
  });

  it('shows empty state when no scrape runs', async () => {
    apiSpy.getScrapeRuns.mockReturnValue(of({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));
    const freshFixture = TestBed.createComponent(AdminScrapeRunsPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const emptyPanel = el.querySelector('.empty-panel');
    expect(emptyPanel).toBeTruthy();
    expect(emptyPanel?.textContent).toContain('No scrape runs');
  });

  it('shows pagination when totalPages > 1', async () => {
    apiSpy.getScrapeRuns.mockReturnValue(of(mockScrapeRuns({ totalPages: 3 })));
    const freshFixture = TestBed.createComponent(AdminScrapeRunsPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const pagination = el.querySelector('.pagination');
    expect(pagination).toBeTruthy();
    expect(pagination?.textContent).toContain('PAGE 1 / 3');
  });

  it('hides pagination when totalPages <= 1', () => {
    const el: HTMLElement = fixture.nativeElement;
    const pagination = el.querySelector('.pagination');
    expect(pagination).toBeFalsy();
  });

  it('passes status filter to API when changed', async () => {
    apiSpy.getScrapeRuns.mockReturnValue(of(mockScrapeRuns()));
    const freshFixture = TestBed.createComponent(AdminScrapeRunsPage);
    freshFixture.detectChanges();

    const select = freshFixture.nativeElement.querySelector('.filter-select') as HTMLSelectElement;
    select.value = 'FAILED';
    select.dispatchEvent(new Event('change'));
    freshFixture.detectChanges();

    // onFilterChange calls load which passes status to API
    const calls = apiSpy.getScrapeRuns.mock.calls;
    const lastCall = calls[calls.length - 1]![0] as Record<string, string>;
    expect(lastCall['status']).toBe('FAILED');
  });

  it('renders table headers', () => {
    const el: HTMLElement = fixture.nativeElement;
    const headers = el.querySelectorAll('.data-th');
    const headerTexts = Array.from(headers).map((h) => h.textContent?.trim() ?? '');
    expect(headerTexts).toContain('STATUS');
    expect(headerTexts).toContain('RUN ID');
    expect(headerTexts).toContain('STORE');
    expect(headerTexts).toContain('DISCOVERED');
  });

  it('displays formatted dates', () => {
    const el: HTMLElement = fixture.nativeElement;
    const dateCells = el.querySelectorAll('.data-td--mono');
    expect(dateCells.length).toBeGreaterThan(0);
  });

  it('displays failed counts with error styling', () => {
    const el: HTMLElement = fixture.nativeElement;
    const errorCells = el.querySelectorAll('.text-error');
    expect(errorCells.length).toBe(2); // both rows have totalFailed > 0
    const errorTexts = Array.from(errorCells).map((c) => c.textContent?.trim() ?? '');
    expect(errorTexts).toContain('5');
    expect(errorTexts).toContain('30');
  });
});
