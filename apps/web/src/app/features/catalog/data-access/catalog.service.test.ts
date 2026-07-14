import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CatalogService, CatalogQueryParams } from './catalog.service';
import { API_BASE_URL } from '../../../core/api.config';

describe('CatalogService', () => {
  let service: CatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' },
        CatalogService
      ]
    });

    service = TestBed.inject(CatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get categories with exact shape', () => {
    const mockResponse = { items: ['CPU', 'GPU'] };
    
    service.getCategories().subscribe(res => {
      expect(Array.isArray(res.items)).toBe(true);
      expect(typeof res.items[0]).toBe('string');
      expect(res.items).toEqual(['CPU', 'GPU']);
    });

    const req = httpMock.expectOne('http://test-api/api/v1/categories');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should get products with exact item shapes and mapped query params', () => {
    const mockResponse = { 
      items: [{
        id: '123',
        title: 'Test',
        category: 'CPU',
        brand: null,
        model: null,
        mpn: null,
        images: [],
        price: 150,
        currency: 'EGP',
        availability: 'IN_STOCK',
        sourceUrl: null,
        createdAt: '2023-01-01'
      }], 
      pagination: { page: 2, pageSize: 10, totalItems: 1, totalPages: 1 } 
    };
    
    service.getProducts({
      page: 2,
      pageSize: 10,
      search: 'rtx',
      sort: 'price_asc'
    }).subscribe(res => {
      expect(res.pagination.page).toBe(2);
      expect(res.items[0]!.currency).toBe('EGP');
      expect(res.items[0]!.createdAt).toBe('2023-01-01');
    });

    const req = httpMock.expectOne((request) => request.url === 'http://test-api/api/v1/products');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('10');
    expect(req.request.params.get('search')).toBe('rtx');
    expect(req.request.params.get('sort')).toBe('price_asc');
    
    req.flush(mockResponse);
  });

  it('should omit undefined query params', () => {
    service.getProducts({
      page: 1,
      pageSize: 24,
    } as CatalogQueryParams).subscribe();

    const req = httpMock.expectOne((request) => request.url === 'http://test-api/api/v1/products');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.get('page')).toBe('1');
    
    req.flush({ items: [], pagination: {} });
  });

  it('should get product by id with exact shape including offers', () => {
    const mockProduct = { 
      id: '123', 
      title: 'Test Product', 
      category: 'CPU',
      brand: null,
      model: null,
      mpn: null,
      images: [], 
      rawSpecifications: [{ label: 'Core', value: '8' }], 
      compatibility: {}, 
      createdAt: '2023-01-01', 
      offers: [{
        id: 'o1', storeCode: 'SIGMA', price: 100, currency: 'EGP', availability: 'IN_STOCK', sourceUrl: null
      }] 
    };
    
    service.getProductById('123').subscribe(res => {
      expect(res.id).toBe('123');
      expect(res.offers.length).toBe(1);
      expect(res.offers[0]!.storeCode).toBe('SIGMA');
    });

    const req = httpMock.expectOne('http://test-api/api/v1/products/123');
    expect(req.request.method).toBe('GET');
    req.flush(mockProduct);
  });

  it('should get product offers with exact shape', () => {
    const mockOffers = { items: [{ id: 'o1', storeCode: 'SIGMA', price: 100, currency: 'EGP', availability: 'IN_STOCK', sourceUrl: 'http' }] };
    
    service.getProductOffers('123').subscribe(res => {
      expect(res.items.length).toBe(1);
      expect(res.items[0]!.currency).toBe('EGP');
      expect(res.items[0]!.availability).toBe('IN_STOCK');
    });

    const req = httpMock.expectOne('http://test-api/api/v1/products/123/offers');
    expect(req.request.method).toBe('GET');
    req.flush(mockOffers);
  });
});
