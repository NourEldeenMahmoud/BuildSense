import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminMatchReviewsPage } from './admin-match-reviews-page.component';
import type { AdminMatchReviewListResponse } from '@buildsense/contracts';

function mockMatchReviews(extra?: { totalItems?: number; page?: number; pageSize?: number; totalPages?: number }): AdminMatchReviewListResponse {
  return {
    items: [
      {
        id: 'mr-001',
        rawSnapshotId: 'snap-001',
        canonicalUrl: 'https://sigma.com/products/nvidia-rtx-4090',
        storeCode: 'sigma',
        status: 'PENDING',
        flagReason: 'Duplicate product detected',
        suggestedCategory: 'GPU',
        resolvedAt: null,
        resolvedBy: null,
        resolutionReason: null,
        linkedProductId: null,
        createdProductId: null,
        createdAt: '2024-06-15T10:00:00Z',
      },
      {
        id: 'mr-002',
        rawSnapshotId: 'snap-002',
        canonicalUrl: 'https://sigma.com/products/amd-ryzen-9-7950x',
        storeCode: 'sigma',
        status: 'LINKED',
        flagReason: 'Similar listing found',
        suggestedCategory: 'CPU',
        resolvedAt: '2024-06-16T12:00:00Z',
        resolvedBy: 'admin@test.com',
        resolutionReason: 'Linked to existing canonical product',
        linkedProductId: 'prod-001',
        createdProductId: null,
        createdAt: '2024-06-14T08:00:00Z',
      },
      {
        id: 'mr-003',
        rawSnapshotId: 'snap-003',
        canonicalUrl: 'https://sigma.com/products/kingston-ram-ddr5',
        storeCode: 'sigma',
        status: 'CREATED_PRODUCT',
        flagReason: 'New product not in catalog',
        suggestedCategory: 'RAM',
        resolvedAt: '2024-06-17T09:00:00Z',
        resolvedBy: 'admin@test.com',
        resolutionReason: 'Created new canonical product',
        linkedProductId: null,
        createdProductId: 'prod-002',
        createdAt: '2024-06-13T07:00:00Z',
      },
      {
        id: 'mr-004',
        rawSnapshotId: 'snap-004',
        canonicalUrl: 'https://sigma.com/products/cheap-accessory',
        storeCode: 'sigma',
        status: 'IGNORED',
        flagReason: 'Not relevant',
        suggestedCategory: null,
        resolvedAt: '2024-06-18T14:00:00Z',
        resolvedBy: 'admin@test.com',
        resolutionReason: 'Not a valid product',
        linkedProductId: null,
        createdProductId: null,
        createdAt: '2024-06-12T06:00:00Z',
      },
    ],
    pagination: {
      page: extra?.page ?? 1,
      pageSize: extra?.pageSize ?? 20,
      totalItems: extra?.totalItems ?? 4,
      totalPages: extra?.totalPages ?? 1,
    },
  };
}

describe('AdminMatchReviewsPage', () => {
  let fixture: ComponentFixture<AdminMatchReviewsPage>;
  let apiSpy: { getMatchReviews: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      getMatchReviews: vi.fn().mockReturnValue(of(mockMatchReviews())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminMatchReviewsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMatchReviewsPage);
    fixture.detectChanges();
  });

  it('renders filter bar with status dropdown', () => {
    const el: HTMLElement = fixture.nativeElement;
    const filterBar = el.querySelector('.filter-bar');
    expect(filterBar).toBeTruthy();
    const select = el.querySelector('.filter-select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['', 'PENDING', 'LINKED', 'CREATED_PRODUCT', 'IGNORED']);
  });

  it('displays total count in filter bar', () => {
    const el: HTMLElement = fixture.nativeElement;
    const count = el.querySelector('.filter-count');
    expect(count?.textContent).toContain('4 TOTAL');
  });

  it('renders data table with rows', () => {
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.data-tr');
    expect(rows.length).toBe(4);
  });

  it('renders status badges with dots', () => {
    const el: HTMLElement = fixture.nativeElement;
    const badges = el.querySelectorAll('.status-badge');
    expect(badges.length).toBe(4);
    const badgeTexts = Array.from(badges).map((b) => b.textContent?.trim() ?? '');
    expect(badgeTexts).toContain('PENDING');
    expect(badgeTexts).toContain('LINKED');
    expect(badgeTexts).toContain('CREATED');
    expect(badgeTexts).toContain('IGNORED');
  });

  it('displays status dots in badges', () => {
    const el: HTMLElement = fixture.nativeElement;
    const dots = el.querySelectorAll('.status-dot');
    expect(dots.length).toBe(4);
  });

  it('renders URL links with truncation', () => {
    const el: HTMLElement = fixture.nativeElement;
    const links = el.querySelectorAll('.run-link');
    expect(links.length).toBe(4);
    // URLs should be truncated
    expect(links[0]?.textContent).toContain('sigma.com');
  });

  it('displays store code in table', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cells = el.querySelectorAll('.data-td');
    const cellTexts = Array.from(cells).map((c) => c.textContent?.trim() ?? '');
    expect(cellTexts).toContain('sigma');
  });

  it('displays flag reasons in table', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cells = el.querySelectorAll('.data-td');
    const cellTexts = Array.from(cells).map((c) => c.textContent?.trim() ?? '');
    expect(cellTexts).toContain('Duplicate product detected');
    expect(cellTexts).toContain('Similar listing found');
  });

  it('displays suggested category or dash', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cells = el.querySelectorAll('.data-td');
    const cellTexts = Array.from(cells).map((c) => c.textContent?.trim() ?? '');
    expect(cellTexts).toContain('GPU');
    expect(cellTexts).toContain('CPU');
    expect(cellTexts).toContain('RAM');
    expect(cellTexts).toContain('\u2014'); // for IGNORED with null suggestedCategory
  });

  it('displays formatted dates', () => {
    const el: HTMLElement = fixture.nativeElement;
    const dateCells = el.querySelectorAll('.data-td--mono');
    expect(dateCells.length).toBe(4);
  });

  it('renders table headers', () => {
    const el: HTMLElement = fixture.nativeElement;
    const headers = el.querySelectorAll('.data-th');
    const headerTexts = Array.from(headers).map((h) => h.textContent?.trim() ?? '');
    expect(headerTexts).toContain('STATUS');
    expect(headerTexts).toContain('URL');
    expect(headerTexts).toContain('STORE');
    expect(headerTexts).toContain('FLAG REASON');
    expect(headerTexts).toContain('CATEGORY');
    expect(headerTexts).toContain('CREATED');
    expect(headerTexts).toContain('ACTIONS');
  });

  it('renders REVIEW action links', () => {
    const el: HTMLElement = fixture.nativeElement;
    const actionLinks = el.querySelectorAll('.action-link');
    expect(actionLinks.length).toBe(4);
    expect(actionLinks[0]?.textContent).toContain('REVIEW');
  });

  it('hides pagination when totalPages <= 1', () => {
    const el: HTMLElement = fixture.nativeElement;
    const pagination = el.querySelector('.pagination');
    expect(pagination).toBeFalsy();
  });

  it('shows pagination when totalPages > 1', async () => {
    apiSpy.getMatchReviews.mockReturnValue(of(mockMatchReviews({ totalPages: 3 })));
    const freshFixture = TestBed.createComponent(AdminMatchReviewsPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const pagination = el.querySelector('.pagination');
    expect(pagination).toBeTruthy();
    expect(pagination?.textContent).toContain('PAGE 1 OF 3');
    expect(pagination?.textContent).toContain('REVIEWS');
  });

  it('passes status filter to API when changed', async () => {
    apiSpy.getMatchReviews.mockReturnValue(of(mockMatchReviews()));
    const freshFixture = TestBed.createComponent(AdminMatchReviewsPage);
    freshFixture.detectChanges();

    const select = freshFixture.nativeElement.querySelector('.filter-select') as HTMLSelectElement;
    select.value = 'PENDING';
    select.dispatchEvent(new Event('change'));
    freshFixture.detectChanges();

    const calls = apiSpy.getMatchReviews.mock.calls;
    const lastCall = calls[calls.length - 1]![0] as Record<string, string>;
    expect(lastCall['status']).toBe('PENDING');
  });

  it('resets to page 1 on filter change', async () => {
    apiSpy.getMatchReviews.mockReturnValue(of(mockMatchReviews({ page: 2 })));
    const freshFixture = TestBed.createComponent(AdminMatchReviewsPage);
    freshFixture.detectChanges();

    const select = freshFixture.nativeElement.querySelector('.filter-select') as HTMLSelectElement;
    select.value = 'LINKED';
    select.dispatchEvent(new Event('change'));
    freshFixture.detectChanges();

    const calls = apiSpy.getMatchReviews.mock.calls;
    const lastCall = calls[calls.length - 1]![0] as Record<string, string>;
    expect(lastCall['page']).toBe('1');
  });

  it('shows error state on API failure', async () => {
    apiSpy.getMatchReviews.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'Server error' } })));
    const failFixture = TestBed.createComponent(AdminMatchReviewsPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('CONNECTION_TIMEOUT');
  });

  it('has retry button in error state', async () => {
    apiSpy.getMatchReviews.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'fail' } })));
    const failFixture = TestBed.createComponent(AdminMatchReviewsPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    const retryBtn = el.querySelector('.retry-btn');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toContain('RETRY');
  });

  it('shows empty state when no reviews', async () => {
    apiSpy.getMatchReviews.mockReturnValue(of({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));
    const freshFixture = TestBed.createComponent(AdminMatchReviewsPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const emptyPanel = el.querySelector('.empty-panel');
    expect(emptyPanel).toBeTruthy();
    expect(emptyPanel?.textContent).toContain('NO MATCHING REVIEWS FOUND');
  });
});
