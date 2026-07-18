import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminDataQualityDetailPage } from './admin-data-quality-detail-page.component';
import type { AdminDataQualityIssueDetailResponse } from '@buildsense/contracts';

function mockDqDetail(overrides?: Partial<AdminDataQualityIssueDetailResponse>): AdminDataQualityIssueDetailResponse {
  return {
    id: 'dq-001',
    issueType: 'MISSING_FIELD',
    severity: 'CRITICAL',
    status: 'OPEN',
    category: 'GPU',
    catalogProductId: 'prod-001',
    rawSnapshotId: 'snap-001',
    description: 'Missing required field: base_clock_mhz',
    resolvedBy: null,
    resolvedAt: null,
    resolutionReason: null,
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

describe('AdminDataQualityDetailPage', () => {
  let fixture: ComponentFixture<AdminDataQualityDetailPage>;
  let apiSpy: {
    getDataQualityIssue: ReturnType<typeof vi.fn>;
    resolveDataQualityIssue: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    apiSpy = {
      getDataQualityIssue: vi.fn().mockReturnValue(of(mockDqDetail())),
      resolveDataQualityIssue: vi.fn().mockReturnValue(of({ success: true })),
    };

    await TestBed.configureTestingModule({
      imports: [AdminDataQualityDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
        { provide: ActivatedRoute, useValue: createActivatedRoute('dq-001') },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDataQualityDetailPage);
    fixture.detectChanges();
  });

  it('reads id from route param', () => {
    expect(apiSpy.getDataQualityIssue).toHaveBeenCalledWith('dq-001');
  });

  it('renders back link to data quality list', () => {
    const el: HTMLElement = fixture.nativeElement;
    const backLink = el.querySelector('.back-link');
    expect(backLink).toBeTruthy();
    expect(backLink?.textContent).toContain('DATA QUALITY');
  });

  it('renders summary strip with status badge', () => {
    const el: HTMLElement = fixture.nativeElement;
    const strip = el.querySelector('.summary-strip');
    expect(strip).toBeTruthy();
    const badge = strip?.querySelector('.status-badge--open');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('OPEN');
  });

  it('renders summary strip with severity badge', () => {
    const el: HTMLElement = fixture.nativeElement;
    const strip = el.querySelector('.summary-strip');
    const sevBadge = strip?.querySelector('.severity-badge--critical');
    expect(sevBadge).toBeTruthy();
    expect(sevBadge?.textContent).toContain('CRITICAL');
  });

  it('displays issue type and category in summary', () => {
    const el: HTMLElement = fixture.nativeElement;
    const strip = el.querySelector('.summary-strip');
    expect(strip?.textContent).toContain('MISSING_FIELD');
    expect(strip?.textContent).toContain('GPU');
  });

  it('renders ISSUE_INFO panel with description', () => {
    const el: HTMLElement = fixture.nativeElement;
    const panelTitles = el.querySelectorAll('.panel-title');
    const issueInfoTitle = Array.from(panelTitles).find((t) =>
      t.textContent?.includes('ISSUE_INFO'),
    );
    expect(issueInfoTitle).toBeTruthy();
    expect(el.textContent).toContain('Missing required field: base_clock_mhz');
  });

  it('displays catalog product ID', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('prod-001');
  });

  it('displays raw snapshot ID', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('snap-001');
  });

  it('displays created date', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('2024');
  });

  it('renders ACTIONS panel with resolve button for OPEN issue', () => {
    const el: HTMLElement = fixture.nativeElement;
    const panelTitles = el.querySelectorAll('.panel-title');
    const actionsTitle = Array.from(panelTitles).find((t) =>
      t.textContent?.includes('ACTIONS'),
    );
    expect(actionsTitle).toBeTruthy();
    const resolveBtn = el.querySelector('.action-btn--resolve');
    expect(resolveBtn).toBeTruthy();
    expect(resolveBtn?.textContent).toContain('RESOLVE ISSUE');
  });

  it('shows resolve form when RESOLVE ISSUE is clicked', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const resolveBtn = el.querySelector('.action-btn--resolve') as HTMLButtonElement;
    resolveBtn.click();
    fixture.detectChanges();

    const form = el.querySelector('.action-form');
    expect(form).toBeTruthy();
    expect(form?.textContent).toContain('RESOLUTION REASON');
  });

  it('shows resolved notice when issue is not OPEN', async () => {
    apiSpy.getDataQualityIssue.mockReturnValue(of(mockDqDetail({
      status: 'RESOLVED',
      resolvedAt: '2024-06-16T12:00:00Z',
      resolvedBy: 'admin@test.com',
      resolutionReason: 'Corrected value',
    })));
    const freshFixture = TestBed.createComponent(AdminDataQualityDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const resolvedNotice = el.querySelector('.resolved-notice');
    expect(resolvedNotice).toBeTruthy();
    expect(resolvedNotice?.textContent).toContain('resolved');
  });

  it('shows resolution info when resolved', async () => {
    apiSpy.getDataQualityIssue.mockReturnValue(of(mockDqDetail({
      status: 'RESOLVED',
      resolvedAt: '2024-06-16T12:00:00Z',
      resolvedBy: 'admin@test.com',
      resolutionReason: 'Corrected value from source',
    })));
    const freshFixture = TestBed.createComponent(AdminDataQualityDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const infoGrid = el.querySelector('.info-grid');
    expect(infoGrid?.textContent).toContain('RESOLVED BY');
    expect(infoGrid?.textContent).toContain('admin@test.com');
    expect(infoGrid?.textContent).toContain('RESOLUTION');
    expect(infoGrid?.textContent).toContain('Corrected value from source');
  });

  it('does not show resolve button for resolved issue', async () => {
    apiSpy.getDataQualityIssue.mockReturnValue(of(mockDqDetail({ status: 'RESOLVED' })));
    const freshFixture = TestBed.createComponent(AdminDataQualityDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const resolveBtn = el.querySelector('.action-btn--resolve');
    expect(resolveBtn).toBeFalsy();
  });

  it('shows error state on API failure', async () => {
    apiSpy.getDataQualityIssue.mockReturnValue(throwError(() => ({ status: 404, error: { error: 'Not found' } })));
    const failFixture = TestBed.createComponent(AdminDataQualityDetailPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('Failed to load issue');
  });

  it('has retry button in error state', async () => {
    apiSpy.getDataQualityIssue.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'fail' } })));
    const failFixture = TestBed.createComponent(AdminDataQualityDetailPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    const retryBtn = el.querySelector('.retry-btn');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toContain('RETRY');
  });

  it('does not show catalog product row when null', async () => {
    apiSpy.getDataQualityIssue.mockReturnValue(of(mockDqDetail({ catalogProductId: null })));
    const freshFixture = TestBed.createComponent(AdminDataQualityDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const labels = el.querySelectorAll('.info-label');
    const labelTexts = Array.from(labels).map((l) => l.textContent?.trim() ?? '');
    expect(labelTexts).not.toContain('CATALOG PRODUCT');
  });

  it('does not show raw snapshot row when null', async () => {
    apiSpy.getDataQualityIssue.mockReturnValue(of(mockDqDetail({ rawSnapshotId: null })));
    const freshFixture = TestBed.createComponent(AdminDataQualityDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const labels = el.querySelectorAll('.info-label');
    const labelTexts = Array.from(labels).map((l) => l.textContent?.trim() ?? '');
    expect(labelTexts).not.toContain('RAW SNAPSHOT');
  });

  it('displays category as dash when null', async () => {
    apiSpy.getDataQualityIssue.mockReturnValue(of(mockDqDetail({ category: null })));
    const freshFixture = TestBed.createComponent(AdminDataQualityDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const strip = el.querySelector('.summary-strip');
    expect(strip?.textContent).toContain('\u2014');
  });

  it('hides resolution fields when resolvedAt is null', () => {
    const el: HTMLElement = fixture.nativeElement;
    const labels = el.querySelectorAll('.info-label');
    const labelTexts = Array.from(labels).map((l) => l.textContent?.trim() ?? '');
    expect(labelTexts).not.toContain('RESOLVED BY');
    expect(labelTexts).not.toContain('RESOLUTION');
  });

  it('displays formatted dates', () => {
    const el: HTMLElement = fixture.nativeElement;
    const infoValues = el.querySelectorAll('.info-value');
    const dateValues = Array.from(infoValues).filter((v) => /\d{4}-\d{2}-\d{2}/.test(v.textContent ?? ''));
    expect(dateValues.length).toBeGreaterThanOrEqual(1);
  });
});
