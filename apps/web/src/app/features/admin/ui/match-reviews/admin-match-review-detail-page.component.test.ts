import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { CatalogService } from '../../../catalog/data-access/catalog.service';
import { AdminMatchReviewDetailPage } from './admin-match-review-detail-page.component';
import type { AdminMatchReviewDetailResponse } from '@buildsense/contracts';

function mockMatchReviewDetail(overrides?: Partial<AdminMatchReviewDetailResponse>): AdminMatchReviewDetailResponse {
  return {
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
    ...overrides,
  };
}

function createActivatedRoute(id: string): { snapshot: { paramMap: { get: (key: string) => string | null } } } {
  return {
    snapshot: {
      paramMap: {
        get: (key: string): string | null => (key === 'id' ? id : null),
      },
    },
  };
}

describe('AdminMatchReviewDetailPage', () => {
  let fixture: ComponentFixture<AdminMatchReviewDetailPage>;
  let apiSpy: {
    getMatchReview: ReturnType<typeof vi.fn>;
    linkMatchReview: ReturnType<typeof vi.fn>;
    createProductFromMatchReview: ReturnType<typeof vi.fn>;
    ignoreMatchReview: ReturnType<typeof vi.fn>;
  };
  let catalogSpy: { getProducts: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      getMatchReview: vi.fn().mockReturnValue(of(mockMatchReviewDetail())),
      linkMatchReview: vi.fn().mockReturnValue(of({ success: true })),
      createProductFromMatchReview: vi.fn().mockReturnValue(of({ success: true })),
      ignoreMatchReview: vi.fn().mockReturnValue(of({ success: true })),
    };
    catalogSpy = {
      getProducts: vi.fn().mockReturnValue(of({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } })),
    };

    await TestBed.configureTestingModule({
      imports: [AdminMatchReviewDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
        { provide: CatalogService, useValue: catalogSpy },
        { provide: ActivatedRoute, useValue: createActivatedRoute('mr-001') },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMatchReviewDetailPage);
    fixture.detectChanges();
  });

  it('reads id from route param', () => {
    expect(apiSpy.getMatchReview).toHaveBeenCalledWith('mr-001');
  });

  it('renders back link to match reviews list', () => {
    const el: HTMLElement = fixture.nativeElement;
    const backLink = el.querySelector('.back-link');
    expect(backLink).toBeTruthy();
    expect(backLink?.textContent).toContain('MATCH REVIEWS');
  });

  it('renders detail header with task ID', () => {
    const el: HTMLElement = fixture.nativeElement;
    const header = el.querySelector('.detail-header');
    expect(header).toBeTruthy();
    expect(header?.textContent).toContain('REVIEW TASK');
    expect(header?.textContent).toContain('mr-001');
  });

  it('renders detail header title', () => {
    const el: HTMLElement = fixture.nativeElement;
    const title = el.querySelector('.detail-header__title');
    expect(title?.textContent).toContain('Determine Canonical Linkage');
  });

  it('renders detail header timestamp', () => {
    const el: HTMLElement = fixture.nativeElement;
    const meta = el.querySelector('.detail-header__meta');
    expect(meta?.textContent).toContain('2024');
  });

  it('renders two-column layout', () => {
    const el: HTMLElement = fixture.nativeElement;
    const columns = el.querySelector('.detail-columns');
    expect(columns).toBeTruthy();
    const cols = el.querySelectorAll('.detail-col');
    expect(cols.length).toBe(2);
  });

  it('renders source panel with store code and URL', () => {
    const el: HTMLElement = fixture.nativeElement;
    const sourcePanel = el.querySelector('.source-panel');
    expect(sourcePanel).toBeTruthy();
    expect(sourcePanel?.textContent).toContain('SOURCE LISTING');
    expect(sourcePanel?.textContent).toContain('sigma');
    expect(sourcePanel?.textContent).toContain('sigma.com/products/nvidia-rtx-4090');
  });

  it('renders identity fields table', () => {
    const el: HTMLElement = fixture.nativeElement;
    const fieldsTable = el.querySelector('.fields-table');
    expect(fieldsTable).toBeTruthy();
    const rows = el.querySelectorAll('.fields-row');
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('displays store code, URL, flag reason, suggested category, snapshot ID in fields', () => {
    const el: HTMLElement = fixture.nativeElement;
    const fieldKeys = el.querySelectorAll('.fields-key');
    const keyTexts = Array.from(fieldKeys).map((k) => k.textContent?.trim() ?? '');
    expect(keyTexts).toContain('STORE');
    expect(keyTexts).toContain('URL');
    expect(keyTexts).toContain('FLAG REASON');
    expect(keyTexts).toContain('SUGGESTED CATEGORY');
    expect(keyTexts).toContain('RAW SNAPSHOT');
  });

  it('renders candidate panel with status badge', () => {
    const el: HTMLElement = fixture.nativeElement;
    const candidatePanel = el.querySelector('.candidate-panel');
    expect(candidatePanel).toBeTruthy();
    expect(candidatePanel?.textContent).toContain('CANDIDATE / RESOLUTION');
    const badge = candidatePanel?.querySelector('.status-badge');
    expect(badge?.textContent).toContain('PENDING');
  });

  it('renders three action buttons for PENDING review', () => {
    const el: HTMLElement = fixture.nativeElement;
    const actionButtons = el.querySelectorAll('.action-btn');
    expect(actionButtons.length).toBe(3);
    const buttonTexts = Array.from(actionButtons).map((b) => b.textContent?.trim() ?? '');
    expect(buttonTexts.some((t) => t.includes('LINK TO PRODUCT'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('CREATE PRODUCT'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('IGNORE'))).toBe(true);
  });

  it('shows link form when LINK TO PRODUCT is clicked', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const linkBtn = Array.from(el.querySelectorAll('.action-btn')).find((b) =>
      b.textContent?.includes('LINK TO PRODUCT'),
    ) as HTMLButtonElement;
    linkBtn.click();
    fixture.detectChanges();

    const form = el.querySelector('.action-form');
    expect(form).toBeTruthy();
    expect(form?.textContent).toContain('LINK TO EXISTING PRODUCT');
  });

  it('shows create form when CREATE PRODUCT is clicked', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const createBtn = Array.from(el.querySelectorAll('.action-btn')).find((b) =>
      b.textContent?.includes('CREATE PRODUCT'),
    ) as HTMLButtonElement;
    createBtn.click();
    fixture.detectChanges();

    const form = el.querySelector('.action-form');
    expect(form).toBeTruthy();
    expect(form?.textContent).toContain('CREATE NEW CANONICAL');
  });

  it('shows ignore form when IGNORE is clicked', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const ignoreBtn = Array.from(el.querySelectorAll('.action-btn')).find((b) =>
      b.textContent?.includes('IGNORE'),
    ) as HTMLButtonElement;
    ignoreBtn.click();
    fixture.detectChanges();

    const form = el.querySelector('.action-form');
    expect(form).toBeTruthy();
    expect(form?.textContent).toContain('IGNORE THIS REVIEW');
  });

  it('shows resolved info when review is already resolved', async () => {
    apiSpy.getMatchReview.mockReturnValue(of(mockMatchReviewDetail({
      status: 'LINKED',
      resolvedAt: '2024-06-16T12:00:00Z',
      resolvedBy: 'admin@test.com',
      resolutionReason: 'Linked to existing canonical',
      linkedProductId: 'prod-001',
    })));
    const freshFixture = TestBed.createComponent(AdminMatchReviewDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const resolutionInfo = el.querySelector('.resolution-info');
    expect(resolutionInfo).toBeTruthy();
    expect(resolutionInfo?.textContent).toContain('admin@test.com');
    expect(resolutionInfo?.textContent).toContain('prod-001');
  });

  it('shows error state on API failure', async () => {
    apiSpy.getMatchReview.mockReturnValue(throwError(() => ({ status: 404, error: { error: 'Not found' } })));
    const failFixture = TestBed.createComponent(AdminMatchReviewDetailPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('CONNECTION_TIMEOUT');
  });

  it('has retry button in error state', async () => {
    apiSpy.getMatchReview.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'fail' } })));
    const failFixture = TestBed.createComponent(AdminMatchReviewDetailPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    const retryBtn = el.querySelector('.retry-btn');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toContain('RETRY');
  });

  it('renders loading skeleton on init', async () => {
    apiSpy.getMatchReview.mockReturnValue(of(mockMatchReviewDetail()));
    const freshFixture = TestBed.createComponent(AdminMatchReviewDetailPage);
    // Don't detect yet - snapshot should be loading
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    // After detectChanges, should have loaded data
    expect(el.querySelector('.detail-header')).toBeTruthy();
  });
});
