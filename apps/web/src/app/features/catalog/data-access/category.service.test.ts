import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CategoryService } from './category.service';
import { API_BASE_URL } from '../../../core/api.config';

describe('CategoryService', () => {
  let service: CategoryService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        CategoryService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' }
      ]
    }).compileComponents();

    service = TestBed.inject(CategoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should not load twice (idempotent)', () => {
    service.load();
    service.load();
    // Only one request should be made
    httpMock.expectOne('http://test-api/api/v1/categories').flush({ items: ['CPU'] });
  });

  it('should expose categories after loading', () => {
    service.load();
    expect(service.loading()).toBe(true);
    httpMock.expectOne('http://test-api/api/v1/categories').flush({ items: ['CPU', 'GPU'] });
    expect(service.categories()).toEqual(['CPU', 'GPU']);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe(null);
  });

  it('should expose error on failure', () => {
    service.load();
    httpMock.expectOne('http://test-api/api/v1/categories').error(new ErrorEvent('network'));
    expect(service.categories()).toEqual([]);
    expect(service.error()).not.toBe(null);
    expect(service.loading()).toBe(false);
  });
});
