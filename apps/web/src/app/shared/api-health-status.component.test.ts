import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../core/api.config';
import { ApiHealthStatusComponent } from './api-health-status.component';

describe('ApiHealthStatusComponent', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ApiHealthStatusComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('shows loading then success', () => {
    const fixture = TestBed.createComponent(ApiHealthStatusComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Checking API...');
    http.expectOne('http://api.test/api/health').flush({ status: 'ok', database: 'connected' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('API and database connected');
  });
  it('shows API unavailable after failure', () => {
    const fixture = TestBed.createComponent(ApiHealthStatusComponent);
    fixture.detectChanges();
    http
      .expectOne('http://api.test/api/health')
      .flush(null, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('API unavailable');
  });
});
