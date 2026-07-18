import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminDataQualityPage } from './admin-data-quality-page.component';
import type { AdminDataQualityIssueListResponse } from '@buildsense/contracts';

function mockDataQualityIssues(extra?: { totalItems?: number; page?: number; pageSize?: number; totalPages?: number }): AdminDataQualityIssueListResponse {
  return {
    items: [
      {
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
      },
      {
        id: 'dq-002',
        issueType: 'TYPE_MISMATCH',
        severity: 'HIGH',
        status: 'OPEN',
        category: 'CPU',
        catalogProductId: 'prod-002',
        rawSnapshotId: 'snap-002',
        description: 'Expected number, got string for field: cores',
        resolvedBy: null,
        resolvedAt: null,
        resolutionReason: null,
        createdAt: '2024-06-14T09:00:00Z',
      },
      {
        id: 'dq-003',
        issueType: 'VALUE_OUT_OF_RANGE',
        severity: 'MEDIUM',
        status: 'RESOLVED',
        category: 'RAM',
        catalogProductId: 'prod-003',
        rawSnapshotId: 'snap-003',
        description: 'TDP value 999W exceeds reasonable range',
        resolvedBy: 'admin@test.com',
        resolvedAt: '2024-06-16T12:00:00Z',
        resolutionReason: 'Corrected value from source',
        createdAt: '2024-06-13T08:00:00Z',
      },
      {
        id: 'dq-004',
        issueType: 'DUPLICATE_VALUE',
        severity: 'LOW',
        status: 'IGNORED',
        category: null,
        catalogProductId: null,
        rawSnapshotId: 'snap-004',
        description: 'Duplicate specification entry detected',
        resolvedBy: 'admin@test.com',
        resolvedAt: '2024-06-17T14:00:00Z',
        resolutionReason: 'Expected behavior',
        createdAt: '2024-06-12T07:00:00Z',
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

describe('AdminDataQualityPage', () => {
  let fixture: ComponentFixture<AdminDataQualityPage>;
  let apiSpy: { getDataQualityIssues: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      getDataQualityIssues: vi.fn().mockReturnValue(of(mockDataQualityIssues())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminDataQualityPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDataQualityPage);
    fixture.detectChanges();
  });

  it('renders filter bar with severity and status dropdowns', () => {
    const el: HTMLElement = fixture.nativeElement;
    const filterBar = el.querySelector('.filter-bar');
    expect(filterBar).toBeTruthy();
    const selects = el.querySelectorAll('.filter-select');
    expect(selects.length).toBe(2);
  });

  it('severity dropdown has correct options', () => {
    const el: HTMLElement = fixture.nativeElement;
    const selects = el.querySelectorAll('.filter-select') as NodeListOf<HTMLSelectElement>;
    const severitySelect = selects[0]!;
    const options = Array.from(severitySelect.options).map((o) => o.value);
    expect(options).toEqual(['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
  });

  it('status dropdown has correct options', () => {
    const el: HTMLElement = fixture.nativeElement;
    const selects = el.querySelectorAll('.filter-select') as NodeListOf<HTMLSelectElement>;
    const statusSelect = selects[1]!;
    const options = Array.from(statusSelect.options).map((o) => o.value);
    expect(options).toEqual(['', 'OPEN', 'RESOLVED', 'IGNORED']);
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

  it('renders severity icons', () => {
    const el: HTMLElement = fixture.nativeElement;
    const sevIcons = el.querySelectorAll('.sev-icon');
    expect(sevIcons.length).toBe(4);
    const iconTexts = Array.from(sevIcons).map((i) => i.textContent?.trim() ?? '');
    expect(iconTexts).toContain('\u25C6'); // diamond for CRITICAL
    expect(iconTexts).toContain('\u25A0'); // square for HIGH
    expect(iconTexts).toContain('\u25B2'); // triangle for MEDIUM
    expect(iconTexts).toContain('\u2014'); // dash for LOW
  });

  it('renders severity badges with correct styling', () => {
    const el: HTMLElement = fixture.nativeElement;
    const badges = el.querySelectorAll('.sev-badge');
    expect(badges.length).toBe(4);
    const badgeTexts = Array.from(badges).map((b) => b.textContent?.trim() ?? '');
    expect(badgeTexts.some((t) => t.includes('CRIT'))).toBe(true);
    expect(badgeTexts.some((t) => t.includes('HIGH'))).toBe(true);
    expect(badgeTexts.some((t) => t.includes('MED'))).toBe(true);
    expect(badgeTexts.some((t) => t.includes('LOW'))).toBe(true);
  });

  it('renders status badges with icons', () => {
    const el: HTMLElement = fixture.nativeElement;
    const statusBadges = el.querySelectorAll('.status-badge');
    expect(statusBadges.length).toBe(4);
    const badgeTexts = Array.from(statusBadges).map((b) => b.textContent?.trim() ?? '');
    expect(badgeTexts.some((t) => t.includes('PENDING_REVIEW'))).toBe(true);
    expect(badgeTexts.some((t) => t.includes('RESOLVED'))).toBe(true);
    expect(badgeTexts.some((t) => t.includes('IGNORED'))).toBe(true);
  });

  it('displays issue types in table', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cells = el.querySelectorAll('.data-td');
    const cellTexts = Array.from(cells).map((c) => c.textContent?.trim() ?? '');
    expect(cellTexts).toContain('MISSING_FIELD');
    expect(cellTexts).toContain('TYPE_MISMATCH');
    expect(cellTexts).toContain('VALUE_OUT_OF_RANGE');
    expect(cellTexts).toContain('DUPLICATE_VALUE');
  });

  it('displays descriptions in table', () => {
    const el: HTMLElement = fixture.nativeElement;
    const descCells = el.querySelectorAll('.data-td--desc');
    expect(descCells.length).toBe(4);
    expect(descCells[0]?.textContent).toContain('Missing required field');
  });

  it('displays category or dash', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cells = el.querySelectorAll('.data-td');
    const cellTexts = Array.from(cells).map((c) => c.textContent?.trim() ?? '');
    expect(cellTexts).toContain('GPU');
    expect(cellTexts).toContain('CPU');
    expect(cellTexts).toContain('RAM');
    expect(cellTexts).toContain('\u2014'); // for NULL category
  });

  it('renders table headers', () => {
    const el: HTMLElement = fixture.nativeElement;
    const headers = el.querySelectorAll('.data-th');
    const headerTexts = Array.from(headers).map((h) => h.textContent?.trim() ?? '');
    expect(headerTexts).toContain('SEV');
    expect(headerTexts).toContain('ISSUE TYPE');
    expect(headerTexts).toContain('DESCRIPTION');
    expect(headerTexts).toContain('CATEGORY');
    expect(headerTexts).toContain('DETECTED_AT');
    expect(headerTexts).toContain('STATUS');
    expect(headerTexts).toContain('ACTION');
  });

  it('renders RESOLVE action links for OPEN issues', () => {
    const el: HTMLElement = fixture.nativeElement;
    const actionLinks = el.querySelectorAll('.action-link');
    expect(actionLinks.length).toBe(4);
    const linkTexts = Array.from(actionLinks).map((l) => l.textContent?.trim() ?? '');
    expect(linkTexts).toContain('RESOLVE');
    expect(linkTexts).toContain('VIEW');
  });

  it('hides pagination when totalPages <= 1', () => {
    const el: HTMLElement = fixture.nativeElement;
    const pagination = el.querySelector('.pagination');
    expect(pagination).toBeFalsy();
  });

  it('shows pagination when totalPages > 1', async () => {
    apiSpy.getDataQualityIssues.mockReturnValue(of(mockDataQualityIssues({ totalPages: 3 })));
    const freshFixture = TestBed.createComponent(AdminDataQualityPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const pagination = el.querySelector('.pagination');
    expect(pagination).toBeTruthy();
    expect(pagination?.textContent).toContain('SHOWING');
    expect(pagination?.textContent).toContain('ISSUES');
  });

  it('displays formatted dates', () => {
    const el: HTMLElement = fixture.nativeElement;
    const dateCells = el.querySelectorAll('.data-td--mono');
    expect(dateCells.length).toBe(4);
  });

  it('passes severity filter to API when changed', async () => {
    apiSpy.getDataQualityIssues.mockReturnValue(of(mockDataQualityIssues()));
    const freshFixture = TestBed.createComponent(AdminDataQualityPage);
    freshFixture.detectChanges();

    const selects = freshFixture.nativeElement.querySelectorAll('.filter-select') as NodeListOf<HTMLSelectElement>;
    const severitySelect = selects[0]!;
    severitySelect.value = 'CRITICAL';
    severitySelect.dispatchEvent(new Event('change'));
    freshFixture.detectChanges();

    const calls = apiSpy.getDataQualityIssues.mock.calls;
    const lastCall = calls[calls.length - 1]![0] as Record<string, string>;
    expect(lastCall['severity']).toBe('CRITICAL');
  });

  it('passes status filter to API when changed', async () => {
    apiSpy.getDataQualityIssues.mockReturnValue(of(mockDataQualityIssues()));
    const freshFixture = TestBed.createComponent(AdminDataQualityPage);
    freshFixture.detectChanges();

    const selects = freshFixture.nativeElement.querySelectorAll('.filter-select') as NodeListOf<HTMLSelectElement>;
    const statusSelect = selects[1]!;
    statusSelect.value = 'OPEN';
    statusSelect.dispatchEvent(new Event('change'));
    freshFixture.detectChanges();

    const calls = apiSpy.getDataQualityIssues.mock.calls;
    const lastCall = calls[calls.length - 1]![0] as Record<string, string>;
    expect(lastCall['status']).toBe('OPEN');
  });

  it('shows active filter chips when filters are applied', async () => {
    apiSpy.getDataQualityIssues.mockReturnValue(of(mockDataQualityIssues()));
    const freshFixture = TestBed.createComponent(AdminDataQualityPage);
    freshFixture.detectChanges();

    const selects = freshFixture.nativeElement.querySelectorAll('.filter-select') as NodeListOf<HTMLSelectElement>;
    const statusSelect = selects[1]!;
    statusSelect.value = 'OPEN';
    statusSelect.dispatchEvent(new Event('change'));
    freshFixture.detectChanges();

    const activeFilters = freshFixture.nativeElement.querySelector('.active-filters');
    expect(activeFilters).toBeTruthy();
    expect(activeFilters?.textContent).toContain('STATUS: OPEN');
  });

  it('shows error state on API failure', async () => {
    apiSpy.getDataQualityIssues.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'Server error' } })));
    const failFixture = TestBed.createComponent(AdminDataQualityPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('CONNECTION_TIMEOUT');
  });

  it('has retry button in error state', async () => {
    apiSpy.getDataQualityIssues.mockReturnValue(throwError(() => ({ status: 500, error: { error: 'fail' } })));
    const failFixture = TestBed.createComponent(AdminDataQualityPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    const retryBtn = el.querySelector('.retry-btn');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toContain('RETRY');
  });

  it('shows empty state when no issues', async () => {
    apiSpy.getDataQualityIssues.mockReturnValue(of({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));
    const freshFixture = TestBed.createComponent(AdminDataQualityPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const emptyPanel = el.querySelector('.empty-panel');
    expect(emptyPanel).toBeTruthy();
    expect(emptyPanel?.textContent).toContain('NO DATA QUALITY ISSUES');
  });

  it('resets to page 1 on filter change', async () => {
    apiSpy.getDataQualityIssues.mockReturnValue(of(mockDataQualityIssues({ page: 2 })));
    const freshFixture = TestBed.createComponent(AdminDataQualityPage);
    freshFixture.detectChanges();

    const selects = freshFixture.nativeElement.querySelectorAll('.filter-select') as NodeListOf<HTMLSelectElement>;
    const severitySelect = selects[0]!;
    severitySelect.value = 'HIGH';
    severitySelect.dispatchEvent(new Event('change'));
    freshFixture.detectChanges();

    const calls = apiSpy.getDataQualityIssues.mock.calls;
    const lastCall = calls[calls.length - 1]![0] as Record<string, string>;
    expect(lastCall['page']).toBe('1');
  });
});
