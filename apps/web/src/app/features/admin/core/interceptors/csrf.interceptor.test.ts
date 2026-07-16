import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  provideHttpClient,
  withInterceptors,
  HttpClient,
} from '@angular/common/http';
import { csrfInterceptor } from './csrf.interceptor';

describe('csrfInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
    // Clear cookies
    document.cookie = 'buildsense_admin_csrf=; max-age=0';
  });

  it('attaches X-CSRF-Token header on POST when cookie exists', () => {
    document.cookie = 'buildsense_admin_csrf=test-csrf-token-abc';

    http.post('/api/test', {}).subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('X-CSRF-Token')).toBe('test-csrf-token-abc');
    req.flush({});
  });

  it('does not attach CSRF header on GET requests', () => {
    document.cookie = 'buildsense_admin_csrf=test-csrf-token-abc';

    http.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('X-CSRF-Token')).toBe(false);
    req.flush({});
  });

  it('does not crash when no CSRF cookie is present', () => {
    http.post('/api/test', {}).subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('X-CSRF-Token')).toBe(false);
    req.flush({});
  });

  it('attaches header on DELETE requests', () => {
    document.cookie = 'buildsense_admin_csrf=delete-token';

    http.delete('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('X-CSRF-Token')).toBe('delete-token');
    req.flush({});
  });
});
