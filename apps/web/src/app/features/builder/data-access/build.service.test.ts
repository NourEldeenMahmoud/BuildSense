import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BuildService } from './build.service';
import { API_BASE_URL } from '../../../core/api.config';
import type { BuildDto, PurchasePlanDto, CandidatesApiResponse } from '@buildsense/contracts';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const EMPTY_BUILD: BuildDto = {
  publicId: 'b0000000-0000-0000-0000-000000000001',
  name: 'Untitled Build',
  version: 1,
  items: [],
  compatibility: {
    overallStatus: 'UNKNOWN',
    slots: [],
  },
  pricing: {
    totalPrice: null,
    itemCount: 0,
  },
  createdAt: '2025-01-15T10:00:00.000Z',
  updatedAt: '2025-01-15T10:00:00.000Z',
};

const BUILD_WITH_ITEM: BuildDto = {
  ...EMPTY_BUILD,
  publicId: 'b0000000-0000-0000-0000-000000000002',
  version: 2,
  items: [
    {
      productId: 'prod-cpu-1',
      slot: 'cpu',
      quantity: 1,
      unitPrice: 15000,
      totalPrice: 15000,
      productName: 'AMD Ryzen 5 7600',
      thumbnailUrl: 'https://img.example.com/cpu.jpg',
      sourceUrl: 'https://sigma.com/item/cpu-1',
      storeCode: 'SIGMA',
    },
  ],
  pricing: {
    totalPrice: 15000,
    itemCount: 1,
  },
};

const PURCHASE_PLAN: PurchasePlanDto = {
  buildPublicId: 'b0000000-0000-0000-0000-000000000001',
  items: [
    {
      productId: 'prod-cpu-1',
      productName: 'AMD Ryzen 5 7600',
      slot: 'cpu',
      quantity: 1,
      unitPrice: 15000,
      totalPrice: 15000,
      sourceUrl: 'https://sigma.com/item/cpu-1',
      storeCode: 'SIGMA',
      availability: 'IN_STOCK',
      lastSeenAt: '2025-01-15T10:00:00.000Z',
    },
  ],
  totalPrice: 15000,
  itemCount: 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BuildService', () => {
  let service: BuildService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' },
        BuildService,
      ],
    });

    service = TestBed.inject(BuildService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // --- createBuild ---

  it('POSTs to /api/v1/builds with empty body for default', () => {
    service.createBuild().subscribe((res) => {
      expect(res.publicId).toBe(EMPTY_BUILD.publicId);
      expect(res.version).toBe(1);
    });

    const req = httpMock.expectOne('http://test-api/api/v1/builds');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(EMPTY_BUILD);
  });

  it('POSTs name when provided', () => {
    service.createBuild({ name: 'My Build' }).subscribe();

    const req = httpMock.expectOne('http://test-api/api/v1/builds');
    expect(req.request.body).toEqual({ name: 'My Build' });
    req.flush(EMPTY_BUILD);
  });

  // --- getBuild ---

  it('GETs /api/v1/builds/:publicId', () => {
    service.getBuild('b001').subscribe((res) => {
      expect(res.publicId).toBe(BUILD_WITH_ITEM.publicId);
      expect(res.items).toHaveLength(1);
    });

    const req = httpMock.expectOne('http://test-api/api/v1/builds/b001');
    expect(req.request.method).toBe('GET');
    req.flush(BUILD_WITH_ITEM);
  });

  // --- updateBuild ---

  it('PATCHes /api/v1/builds/:publicId with name and expectedVersion', () => {
    service.updateBuild('b001', { name: 'Renamed', expectedVersion: 3 }).subscribe();

    const req = httpMock.expectOne('http://test-api/api/v1/builds/b001');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Renamed', expectedVersion: 3 });
    req.flush({ ...EMPTY_BUILD, name: 'Renamed', version: 4 });
  });

  // --- putItem ---

  it('PUTs to /api/v1/builds/:publicId/items/:slot', () => {
    service.putItem('b001', 'cpu', {
      productId: 'prod-1',
      quantity: 1,
      expectedVersion: 1,
    }).subscribe((res) => {
      expect(res.items).toHaveLength(1);
    });

    const req = httpMock.expectOne('http://test-api/api/v1/builds/b001/items/cpu');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      productId: 'prod-1',
      quantity: 1,
      expectedVersion: 1,
    });
    req.flush(BUILD_WITH_ITEM);
  });

  // --- deleteItem ---

  it('DELETEs /api/v1/builds/:publicId/items/:slot with body', () => {
    service.deleteItem('b001', 'cpu', { expectedVersion: 2 }).subscribe((res) => {
      expect(res.publicId).toBe(EMPTY_BUILD.publicId);
      expect(res.items).toHaveLength(0);
    });

    const req = httpMock.expectOne('http://test-api/api/v1/builds/b001/items/cpu');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ expectedVersion: 2 });
    req.flush(EMPTY_BUILD);
  });

  // --- validateBuild ---

  it('POSTs to /api/v1/builds/:publicId/validate', () => {
    service.validateBuild('b001').subscribe((res) => {
      expect(res.compatibility.overallStatus).toBe('UNKNOWN');
    });

    const req = httpMock.expectOne('http://test-api/api/v1/builds/b001/validate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(EMPTY_BUILD);
  });

  // --- getPurchasePlan ---

  it('GETs /api/v1/builds/:publicId/purchase-plan', () => {
    service.getPurchasePlan('b001').subscribe((res) => {
      expect(res.items).toHaveLength(1);
      expect(res.totalPrice).toBe(15000);
    });

    const req = httpMock.expectOne('http://test-api/api/v1/builds/b001/purchase-plan');
    expect(req.request.method).toBe('GET');
    req.flush(PURCHASE_PLAN);
  });

  // --- getCandidates ---

  it('GETs /api/v1/builds/:publicId/candidates/:slot', () => {
    const mockResponse: CandidatesApiResponse = {
      groups: [
        {
          status: 'COMPATIBLE',
          products: [
            {
              productId: 'prod-1',
              name: 'Test CPU',
              thumbnailUrl: null,
              price: 15000,
              sourceUrl: 'https://sigma.com/item/1',
              storeCode: 'SIGMA',
            },
          ],
          topReasons: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    };

    service.getCandidates('b001', 'cpu').subscribe((res) => {
      expect(res.groups).toHaveLength(1);
      expect(res.groups[0]!.status).toBe('COMPATIBLE');
      expect(res.groups[0]!.products).toHaveLength(1);
      expect(res.pagination.totalItems).toBe(1);
    });

    const req = httpMock.expectOne('http://test-api/api/v1/builds/b001/candidates/cpu');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});
