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

  it('getReferenceDatasets sends GET with withCredentials', () => {
    service.getReferenceDatasets().subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/admin/reference-datasets`);
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
});
