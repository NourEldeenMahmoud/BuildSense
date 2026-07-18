import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { CatalogService } from '../../../catalog/data-access/catalog.service';
import { AdminEligibilityPage } from './admin-eligibility-page.component';
import type {
  AdminEligibilityOverrideListResponse,
  AdminEligibilityOverrideResponse,
} from '@buildsense/contracts';
import type { CatalogProductListResponse } from '../../../../shared/contracts/catalog';

function mockOverrides(extra?: { totalItems?: number; page?: number; totalPages?: number }): AdminEligibilityOverrideListResponse {
  return {
    items: [
      {
        id: 'ov-001',
        productId: 'prod-001',
        previousEligibility: 'NOT_ELIGIBLE',
        newEligibility: 'ELIGIBLE',
        adminId: 'admin@test.com',
        reason: 'Verified component specs manually',
        createdAt: '2024-06-15T10:00:00Z',
      },
      {
        id: 'ov-002',
        productId: 'prod-002',
        previousEligibility: 'ELIGIBLE',
        newEligibility: 'NOT_ELIGIBLE',
        adminId: 'admin@test.com',
        reason: 'Incompatible with builder socket type',
        createdAt: '2024-06-14T09:00:00Z',
      },
    ],
    pagination: {
      page: extra?.page ?? 1,
      pageSize: 20,
      totalItems: extra?.totalItems ?? 2,
      totalPages: extra?.totalPages ?? 1,
    },
  };
}

function mockCatalogSearch(): CatalogProductListResponse {
  return {
    items: [
      {
        id: 'prod-001',
        title: 'NVIDIA RTX 4090',
        category: 'GPU',
        brand: 'NVIDIA',
        model: 'RTX 4090',
        mpn: null,
        images: [],
        price: null,
        currency: 'EGP',
        availability: 'IN_STOCK',
        sourceUrl: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    pagination: { page: 1, pageSize: 8, totalItems: 1, totalPages: 1 },
  };
}

function mockOverrideResponse(): AdminEligibilityOverrideResponse {
  return {
    ok: true as const,
    productId: 'prod-001',
    previousEligibility: 'NOT_ELIGIBLE',
    newEligibility: 'ELIGIBLE',
  };
}

describe('AdminEligibilityPage', () => {
  let fixture: ComponentFixture<AdminEligibilityPage>;
  let apiSpy: {
    getEligibilityOverrides: ReturnType<typeof vi.fn>;
    overrideEligibility: ReturnType<typeof vi.fn>;
  };
  let catalogSpy: {
    getProducts: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    apiSpy = {
      getEligibilityOverrides: vi.fn().mockReturnValue(of(mockOverrides())),
      overrideEligibility: vi.fn().mockReturnValue(of(mockOverrideResponse())),
    };
    catalogSpy = {
      getProducts: vi.fn().mockReturnValue(of(mockCatalogSearch())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminEligibilityPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
        { provide: CatalogService, useValue: catalogSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminEligibilityPage);
    fixture.detectChanges();
  });

  it('renders page intro text', () => {
    const el: HTMLElement = fixture.nativeElement;
    const intro = el.querySelector('.page-intro-text');
    expect(intro).toBeTruthy();
    expect(intro?.textContent).toContain('Set product eligibility');
  });

  it('renders override form panel with title', () => {
    const el: HTMLElement = fixture.nativeElement;
    const title = el.querySelector('.action-panel-title');
    expect(title?.textContent).toContain('NEW OVERRIDE');
  });

  it('has product search input', () => {
    const el: HTMLElement = fixture.nativeElement;
    const input = el.querySelector('.form-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toContain('Search product');
  });

  it('has eligibility select with correct options', () => {
    const el: HTMLElement = fixture.nativeElement;
    const select = el.querySelector('.form-select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toEqual(['', 'ELIGIBLE', 'NOT_ELIGIBLE']);
  });

  it('has reason textarea', () => {
    const el: HTMLElement = fixture.nativeElement;
    const textarea = el.querySelector('.form-textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.placeholder).toContain('Why is this');
  });

  it('submit button is disabled when form is incomplete', () => {
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector('.form-btn--submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders override history table with rows', () => {
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.data-tr');
    expect(rows.length).toBe(2);
  });

  it('renders table headers', () => {
    const el: HTMLElement = fixture.nativeElement;
    const headers = el.querySelectorAll('.data-th');
    const headerTexts = Array.from(headers).map(h => h.textContent?.trim() ?? '');
    expect(headerTexts).toContain('PRODUCT ID');
    expect(headerTexts).toContain('PREVIOUS');
    expect(headerTexts).toContain('NEW');
    expect(headerTexts).toContain('ADMIN');
    expect(headerTexts).toContain('REASON');
    expect(headerTexts).toContain('CREATED');
  });

  it('renders eligibility tags with correct classes', () => {
    const el: HTMLElement = fixture.nativeElement;
    const tags = el.querySelectorAll('.eligibility-tag');
    expect(tags.length).toBe(4); // 2 rows x 2 tags (previous + new)
    const tagClasses = Array.from(tags).map(t => t.className);
    expect(tagClasses.some(c => c.includes('eligible'))).toBe(true);
    expect(tagClasses.some(c => c.includes('not_eligible'))).toBe(true);
  });

  it('renders total count', () => {
    const el: HTMLElement = fixture.nativeElement;
    const count = el.querySelector('.section-count');
    expect(count?.textContent).toContain('2');
  });

  it('hides pagination when totalPages <= 1', () => {
    const el: HTMLElement = fixture.nativeElement;
    const pagination = el.querySelector('.pagination');
    expect(pagination).toBeFalsy();
  });

  it('shows pagination when totalPages > 1', async () => {
    apiSpy.getEligibilityOverrides.mockReturnValue(of(mockOverrides({ totalPages: 3 })));
    const fresh = TestBed.createComponent(AdminEligibilityPage);
    fresh.detectChanges();
    const el: HTMLElement = fresh.nativeElement;
    const pagination = el.querySelector('.pagination');
    expect(pagination).toBeTruthy();
    expect(pagination?.textContent).toContain('PREV');
    expect(pagination?.textContent).toContain('NEXT');
  });

  it('calls getEligibilityOverrides on init', () => {
    expect(apiSpy.getEligibilityOverrides).toHaveBeenCalled();
  });

  it('passes page and pageSize params', () => {
    const call = apiSpy.getEligibilityOverrides.mock.calls[0]![0];
    expect(call.page).toBe('1');
    expect(call.pageSize).toBe('20');
  });

  it('calls CatalogService.getProducts when search query is >= 2 chars', () => {
    const el: HTMLElement = fixture.nativeElement;
    const input = el.querySelector('.form-input') as HTMLInputElement;
    input.value = 'RTX';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(catalogSpy.getProducts).toHaveBeenCalledWith({ search: 'RTX', pageSize: 8 });
  });

  it('does not search when query is < 2 chars', () => {
    catalogSpy.getProducts.mockClear();
    const el: HTMLElement = fixture.nativeElement;
    const input = el.querySelector('.form-input') as HTMLInputElement;
    input.value = 'R';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(catalogSpy.getProducts).not.toHaveBeenCalled();
  });

  it('shows error state on API failure', async () => {
    apiSpy.getEligibilityOverrides.mockReturnValue(
      throwError(() => ({ status: 500, error: { error: 'Server error' } }))
    );
    const failFixture = TestBed.createComponent(AdminEligibilityPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('Failed to load overrides');
  });

  it('has retry button in error state', async () => {
    apiSpy.getEligibilityOverrides.mockReturnValue(
      throwError(() => ({ status: 500, error: { error: 'fail' } }))
    );
    const failFixture = TestBed.createComponent(AdminEligibilityPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    const retryBtn = el.querySelector('.retry-btn');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toContain('RETRY');
  });

  it('shows empty state when no overrides', async () => {
    apiSpy.getEligibilityOverrides.mockReturnValue(of({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));
    const fresh = TestBed.createComponent(AdminEligibilityPage);
    fresh.detectChanges();
    const el: HTMLElement = fresh.nativeElement;
    const emptyPanel = el.querySelector('.empty-panel');
    expect(emptyPanel).toBeTruthy();
    expect(emptyPanel?.textContent).toContain('No overrides yet');
  });

  it('does not render Audit Log nav item', () => {
    // The shell component owns nav items; this test verifies the eligibility component
    // does not have any audit log references. The shell navItems array (verified by reading
    // admin-shell.component.ts) does not contain an Audit Log entry.
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Audit Log');
    expect(el.textContent).not.toContain('AUDIT_LOG');
  });
});
