import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api.config';
import { ApiHealthService } from './api-health.service';

describe('ApiHealthService', () => {
  let health: ApiHealthService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    health = TestBed.inject(ApiHealthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('sets success for a connected API', () => {
    health.check();
    http.expectOne('http://api.test/api/health').flush({ status: 'ok', database: 'connected' });
    expect(health.state()).toBe('success');
  });
  it('sets error when the API is unavailable', () => {
    health.check();
    http
      .expectOne('http://api.test/api/health')
      .flush(null, { status: 503, statusText: 'Unavailable' });
    expect(health.state()).toBe('error');
  });
});
