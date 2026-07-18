import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminJobsPage } from './admin-jobs-page.component';
import type { AdminJobListResponse } from '@buildsense/contracts';

function mockJobs(): AdminJobListResponse {
  return {
    items: [
      {
        id: 'job-001',
        jobType: 'REPROCESS_CATALOG',
        status: 'SUCCEEDED',
        requestedBy: 'admin@test.com',
        reason: 'Reprocess after normalization fix',
        params: { category: 'CPU' },
        claimedBy: 'worker-01',
        claimedAt: '2024-01-01T10:00:00Z',
        attempts: 1,
        maxAttempts: 3,
        completedAt: '2024-01-01T10:05:00Z',
        result: { processed: 150 },
        errorSummary: null,
        createdAt: '2024-01-01T10:00:00Z',
      },
      {
        id: 'job-002',
        jobType: 'BACKFILL_FACTS',
        status: 'FAILED',
        requestedBy: 'admin@test.com',
        reason: 'Backfill compatibility facts',
        params: {},
        claimedBy: 'worker-01',
        claimedAt: '2024-01-01T09:00:00Z',
        attempts: 3,
        maxAttempts: 3,
        completedAt: '2024-01-01T09:10:00Z',
        result: null,
        errorSummary: 'Connection timeout to worker',
        createdAt: '2024-01-01T09:00:00Z',
      },
    ],
    pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
  };
}

describe('AdminJobsPage', () => {
  let fixture: ComponentFixture<AdminJobsPage>;
  let apiSpy: { getJobs: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      getJobs: vi.fn().mockReturnValue(of(mockJobs())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminJobsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminJobsPage);
    fixture.detectChanges();
  });

  it('renders filter bar with status and type dropdowns', () => {
    const el: HTMLElement = fixture.nativeElement;
    const filterBar = el.querySelector('.filter-bar');
    expect(filterBar).toBeTruthy();
    const selects = el.querySelectorAll('.filter-select');
    expect(selects.length).toBe(2);
  });

  it('has correct status filter options', () => {
    const el: HTMLElement = fixture.nativeElement;
    const selects = el.querySelectorAll('.filter-select');
    const statusSelect = selects[0] as HTMLSelectElement;
    const options = Array.from(statusSelect.options).map((o) => o.value);
    expect(options).toEqual(['', 'PENDING', 'CLAIMED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']);
  });

  it('has correct type filter options matching contract', () => {
    const el: HTMLElement = fixture.nativeElement;
    const selects = el.querySelectorAll('.filter-select');
    const typeSelect = selects[1] as HTMLSelectElement;
    const options = Array.from(typeSelect.options).map((o) => o.value);
    expect(options).toEqual(['', 'REPROCESS_CATALOG', 'BACKFILL_FACTS', 'REPROCESS_CATEGORY']);
  });

  it('displays total count', () => {
    const el: HTMLElement = fixture.nativeElement;
    const count = el.querySelector('.filter-count');
    expect(count?.textContent).toContain('2 total');
  });

  it('does NOT render enqueue job panel', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.action-panel')).toBeFalsy();
    expect(el.querySelector('.action-panel--disabled')).toBeFalsy();
  });

  it('does NOT render info banner', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.info-banner')).toBeFalsy();
  });

  it('renders data table with rows', () => {
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.data-tr');
    expect(rows.length).toBe(2);
  });

  it('renders status badges with correct styling', () => {
    const el: HTMLElement = fixture.nativeElement;
    const succeeded = el.querySelector('.status-badge--succeeded');
    expect(succeeded).toBeTruthy();
    expect(succeeded?.textContent).toContain('SUCCEEDED');
    const failed = el.querySelector('.status-badge--failed');
    expect(failed).toBeTruthy();
    expect(failed?.textContent).toContain('FAILED');
  });

  it('renders type tags', () => {
    const el: HTMLElement = fixture.nativeElement;
    const typeTags = el.querySelectorAll('.type-tag');
    expect(typeTags.length).toBe(2);
    expect(typeTags[0]?.textContent).toContain('REPROCESS_CATALOG');
    expect(typeTags[1]?.textContent).toContain('BACKFILL_FACTS');
  });

  it('renders job detail links with actual IDs', () => {
    const el: HTMLElement = fixture.nativeElement;
    const links = el.querySelectorAll('.action-link');
    expect(links.length).toBe(2);
    expect(links[0]?.textContent).toContain('VIEW');
  });

  it('renders attempts as attempts/maxAttempts', () => {
    const el: HTMLElement = fixture.nativeElement;
    const monoCells = el.querySelectorAll('.data-td--mono');
    const texts = Array.from(monoCells).map((c) => c.textContent?.trim() ?? '');
    expect(texts).toContain('1/3');
    expect(texts).toContain('3/3');
  });

  it('displays reason text', () => {
    const el: HTMLElement = fixture.nativeElement;
    const reasonCells = el.querySelectorAll('.data-td--reason');
    expect(reasonCells.length).toBe(2);
    expect(reasonCells[0]?.textContent).toContain('Reprocess after normalization fix');
  });

  it('shows error state on API failure', async () => {
    apiSpy.getJobs.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'fail' } })));
    const failFixture = TestBed.createComponent(AdminJobsPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('Failed to load jobs');
  });

  it('shows empty state when no jobs', async () => {
    apiSpy.getJobs.mockReturnValue(of({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));
    const freshFixture = TestBed.createComponent(AdminJobsPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    expect(el.querySelector('.empty-panel')).toBeTruthy();
    expect(el.querySelector('.empty-title')?.textContent).toContain('No jobs');
  });

  it('shows pagination when totalPages > 1', async () => {
    apiSpy.getJobs.mockReturnValue(of({
      items: mockJobs().items,
      pagination: { page: 1, pageSize: 20, totalItems: 50, totalPages: 3 },
    }));
    const freshFixture = TestBed.createComponent(AdminJobsPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const pagination = el.querySelector('.pagination');
    expect(pagination).toBeTruthy();
    expect(pagination?.textContent).toContain('PAGE 1 / 3');
  });

  it('hides pagination when totalPages <= 1', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.pagination')).toBeFalsy();
  });

  it('passes status filter to API', async () => {
    apiSpy.getJobs.mockReturnValue(of(mockJobs()));
    const freshFixture = TestBed.createComponent(AdminJobsPage);
    freshFixture.detectChanges();

    const selects = freshFixture.nativeElement.querySelectorAll('.filter-select');
    const statusSelect = selects[0] as HTMLSelectElement;
    statusSelect.value = 'FAILED';
    statusSelect.dispatchEvent(new Event('change'));
    freshFixture.detectChanges();

    const calls = apiSpy.getJobs.mock.calls;
    const lastCall = calls[calls.length - 1]![0] as Record<string, string>;
    expect(lastCall['status']).toBe('FAILED');
  });

  it('passes type filter to API', async () => {
    apiSpy.getJobs.mockReturnValue(of(mockJobs()));
    const freshFixture = TestBed.createComponent(AdminJobsPage);
    freshFixture.detectChanges();

    const selects = freshFixture.nativeElement.querySelectorAll('.filter-select');
    const typeSelect = selects[1] as HTMLSelectElement;
    typeSelect.value = 'BACKFILL_FACTS';
    typeSelect.dispatchEvent(new Event('change'));
    freshFixture.detectChanges();

    const calls = apiSpy.getJobs.mock.calls;
    const lastCall = calls[calls.length - 1]![0] as Record<string, string>;
    expect(lastCall['jobType']).toBe('BACKFILL_FACTS');
  });

  it('renders table headers', () => {
    const el: HTMLElement = fixture.nativeElement;
    const headers = el.querySelectorAll('.data-th');
    const headerTexts = Array.from(headers).map((h) => h.textContent?.trim() ?? '');
    expect(headerTexts).toContain('STATUS');
    expect(headerTexts).toContain('TYPE');
    expect(headerTexts).toContain('REASON');
    expect(headerTexts).toContain('ACTIONS');
  });
});
