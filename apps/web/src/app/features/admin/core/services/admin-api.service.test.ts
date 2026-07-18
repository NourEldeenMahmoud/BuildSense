import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { csrfInterceptor } from '../interceptors/csrf.interceptor';
import { AdminApiService } from './admin-api.service';
import { API_BASE_URL } from '../../../../core/api.config';

describe('AdminApiService', () => {
  let httpMock: HttpTestingController;
  let service: AdminApiService;
  const baseUrl = 'http://localhost:3000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: baseUrl },
        AdminApiService,
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AdminApiService);
  });

  it('login sends email/password with withCredentials', () => {
    service.login('admin@test.com', 'pass123').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ email: 'admin@test.com', password: 'pass123' });
    req.flush({ ok: true });
  });

  it('logout sends POST with CSRF header and withCredentials', () => {
    document.cookie = 'buildsense_admin_csrf=csrf-val';

    service.logout('csrf-val').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/auth/logout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Token')).toBe('csrf-val');
    req.flush({ ok: true });
  });

  it('me sends GET with withCredentials', () => {
    service.me().subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/auth/me`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: '1', email: 'a@b.com', role: 'ADMIN', createdAt: '', updatedAt: '' });
  });

  it('getDashboard sends GET with withCredentials', () => {
    service.getDashboard().subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/dashboard`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ scrapeRuns: {}, catalog: {}, compatibilityQuality: {}, referenceDatasets: {}, worker: {} });
  });

  it('getScrapeRuns sends GET with pagination params', () => {
    service.getScrapeRuns({ page: '2', pageSize: '10' }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/api/v1/admin/scrape-runs` && r.params.get('page') === '2',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush({ items: [], pagination: { page: 2, pageSize: 10, totalItems: 0, totalPages: 0 } });
  });

  it('getScrapeRun sends GET to specific run endpoint', () => {
    service.getScrapeRun('run-abc-123').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/scrape-runs/run-abc-123`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: '1', runId: 'run-abc-123' });
  });

  it('getCompatibilityQuality sends GET with withCredentials', () => {
    service.getCompatibilityQuality().subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/compatibility-quality`);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ items: [] });
  });

  it('getCatalogStats sends GET with withCredentials', () => {
    service.getCatalogStats().subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/catalog-stats`);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ totalProducts: 0, totalOffers: 0, totalDiscovered: 0, productsByCategory: [], productsByEligibility: { eligible: 0, notEligible: 0 } });
  });

  it('getWorkerStatus sends GET with withCredentials', () => {
    service.getWorkerStatus().subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/worker-status`);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ activeLocks: [] });
  });

  // ── Phase 4: Match Reviews ───────────────────────────────────────────
  it('getMatchReviews sends GET with query params', () => {
    service.getMatchReviews({ page: '1', status: 'PENDING' }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/api/v1/admin/match-reviews` && r.params.get('status') === 'PENDING',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } });
  });

  it('getMatchReview sends GET to specific review', () => {
    service.getMatchReview('mr-1').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/match-reviews/mr-1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: 'mr-1', status: 'PENDING' });
  });

  it('linkMatchReview sends POST with CSRF header', () => {
    document.cookie = 'buildsense_admin_csrf=csrf-val';
    service.linkMatchReview('mr-1', { catalogProductId: 'p-1', reason: 'Match' }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/match-reviews/mr-1/link`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Token')).toBe('csrf-val');
    expect(req.request.body).toEqual({ catalogProductId: 'p-1', reason: 'Match' });
    req.flush({ id: 'mr-1', status: 'LINKED' });
  });

  it('ignoreMatchReview sends POST with CSRF header', () => {
    document.cookie = 'buildsense_admin_csrf=csrf-val';
    service.ignoreMatchReview('mr-1', { reason: 'Not a real product' }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/match-reviews/mr-1/ignore`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Token')).toBe('csrf-val');
    expect(req.request.body).toEqual({ reason: 'Not a real product' });
    req.flush({ id: 'mr-1', status: 'IGNORED' });
  });

  it('createProductFromMatchReview sends POST with CSRF header', () => {
    document.cookie = 'buildsense_admin_csrf=csrf-val';
    service.createProductFromMatchReview('mr-1', {
      title: 'RTX 5090', category: 'GPU', brand: null, reason: 'New product',
    }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/match-reviews/mr-1/create-product`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Token')).toBe('csrf-val');
    req.flush({ id: 'mr-1', status: 'CREATED' });
  });

  // ── Phase 4: Data Quality Issues ─────────────────────────────────────
  it('getDataQualityIssues sends GET with query params', () => {
    service.getDataQualityIssues({ page: '1', status: 'OPEN' }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/api/v1/admin/data-quality-issues` && r.params.get('status') === 'OPEN',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } });
  });

  it('getDataQualityIssue sends GET to specific issue', () => {
    service.getDataQualityIssue('dq-1').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/data-quality-issues/dq-1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: 'dq-1', status: 'OPEN' });
  });

  it('resolveDataQualityIssue sends POST with CSRF header', () => {
    document.cookie = 'buildsense_admin_csrf=csrf-val';
    service.resolveDataQualityIssue('dq-1', { reason: 'Fixed in source' }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/data-quality-issues/dq-1/resolve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Token')).toBe('csrf-val');
    expect(req.request.body).toEqual({ reason: 'Fixed in source' });
    req.flush({ id: 'dq-1', status: 'RESOLVED' });
  });

  // ── Phase 4: Eligibility Overrides ───────────────────────────────────
  it('getEligibilityOverrides sends GET with query params', () => {
    service.getEligibilityOverrides({ page: '2' }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/api/v1/admin/eligibility-overrides` && r.params.get('page') === '2',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ items: [], pagination: { page: 2, pageSize: 20, totalItems: 0, totalPages: 0 } });
  });

  it('overrideEligibility sends POST with CSRF header', () => {
    document.cookie = 'buildsense_admin_csrf=csrf-val';
    service.overrideEligibility('p-1', {
      eligibility: 'ELIGIBLE', reason: 'Now eligible',
    }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/eligibility/p-1/override`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Token')).toBe('csrf-val');
    expect(req.request.body).toEqual({ eligibility: 'ELIGIBLE', reason: 'Now eligible' });
    req.flush({ ok: true, productId: 'p-1', previousEligibility: 'NOT_ELIGIBLE', newEligibility: 'ELIGIBLE' });
  });

  // ── Phase 4: Worker Jobs ─────────────────────────────────────────────
  it('getJobs sends GET with query params', () => {
    service.getJobs({ page: '1', status: 'PENDING', jobType: 'REPROCESS_CATALOG' }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/api/v1/admin/jobs`
        && r.params.get('status') === 'PENDING'
        && r.params.get('jobType') === 'REPROCESS_CATALOG',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } });
  });

  it('getJob sends GET to specific job', () => {
    service.getJob('job-1').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/jobs/job-1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: 'job-1', status: 'PENDING' });
  });

  it('requestReprocessJob sends POST with CSRF header', () => {
    document.cookie = 'buildsense_admin_csrf=csrf-val';
    service.requestReprocessJob({ jobType: 'REPROCESS_CATALOG', reason: 'Retry' }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/jobs/reprocess`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Token')).toBe('csrf-val');
    expect(req.request.body).toEqual({ jobType: 'REPROCESS_CATALOG', reason: 'Retry' });
    req.flush({ id: 'job-2', status: 'PENDING' });
  });
});
