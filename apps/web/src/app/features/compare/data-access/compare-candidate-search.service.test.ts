import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError, Subject } from 'rxjs';
import { CompareCandidateSearchService } from './compare-candidate-search.service';
import { CatalogService } from '../../catalog/data-access/catalog.service';
import type { CatalogProductListResponse } from '../../../shared/contracts/catalog';

function makeResponse(
  items: Array<{ id: string; title: string }>,
  totalItems: number,
  totalPages: number,
): CatalogProductListResponse {
  return {
    items: items.map((i) => ({
      ...i,
      category: 'CPU',
      brand: null,
      model: null,
      mpn: null,
      images: [],
      price: null,
      currency: 'EGP',
      availability: 'IN_STOCK',
      sourceUrl: null,
      createdAt: '2024-01-01',
    })),
    pagination: { page: 1, pageSize: 12, totalItems, totalPages },
  };
}

function flush(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('CompareCandidateSearchService', () => {
  let service: CompareCandidateSearchService;
  let mockGetProducts: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetProducts = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        CompareCandidateSearchService,
        { provide: CatalogService, useValue: { getProducts: mockGetProducts } },
      ],
    });

    service = TestBed.inject(CompareCandidateSearchService);
  });

  it('starts with empty state', () => {
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
    expect(service.items()).toEqual([]);
    expect(service.page()).toBe(1);
    expect(service.totalItems()).toBe(0);
    expect(service.totalPages()).toBe(0);
    expect(service.query()).toBe('');
    expect(service.category()).toBe('');
  });

  it('sends correct request params (category, page, pageSize, search)', async () => {
    mockGetProducts.mockReturnValue(of(makeResponse([{ id: '1', title: 'CPU A' }], 1, 1)));

    service.search('CPU', 'ryzen', 1, 12, 'exclude-id');
    await flush(400); // debounce 300 + buffer

    expect(mockGetProducts).toHaveBeenCalledTimes(1);
    expect(mockGetProducts).toHaveBeenCalledWith({
      category: 'CPU',
      page: 1,
      pageSize: 12,
      search: 'ryzen',
    });
  });

  it('omits search param when query is empty', async () => {
    mockGetProducts.mockReturnValue(of(makeResponse([], 0, 0)));

    service.search('GPU', '', 1, 12, 'exclude-id');
    await flush(400);

    expect(mockGetProducts).toHaveBeenCalledWith({
      category: 'GPU',
      page: 1,
      pageSize: 12,
    });
  });

  it('does not send unsupported query params', async () => {
    mockGetProducts.mockReturnValue(of(makeResponse([], 0, 0)));

    service.search('CPU', 'test', 2, 20, 'exclude-id');
    await flush(400);

    const calledParams = mockGetProducts.mock.calls[0]![0]!;
    expect(calledParams).not.toHaveProperty('brand');
    expect(calledParams).not.toHaveProperty('minPrice');
    expect(calledParams).not.toHaveProperty('maxPrice');
    expect(calledParams).not.toHaveProperty('sort');
  });

  it('excludes slot A product from results', async () => {
    const response = makeResponse(
      [
        { id: 'exclude-id', title: 'Should be filtered' },
        { id: 'keep-id', title: 'Should remain' },
      ],
      2,
      1,
    );
    mockGetProducts.mockReturnValue(of(response));

    service.search('CPU', '', 1, 12, 'exclude-id');
    await flush(400);

    expect(service.items()).toHaveLength(1);
    expect(service.items()[0]!.id).toBe('keep-id');
  });

  it('resets page to 1 on new search', async () => {
    // First call: page 3
    mockGetProducts.mockReturnValueOnce(
      of(makeResponse([{ id: '1', title: 'A' }], 30, 3)),
    );
    service.search('CPU', 'a', 3, 12, 'ex');
    await flush(400);
    expect(service.page()).toBe(3);

    // Second call: new search should reset to page 1
    mockGetProducts.mockReturnValueOnce(
      of(makeResponse([{ id: '2', title: 'B' }], 10, 1)),
    );
    service.search('CPU', 'b', 1, 12, 'ex');
    await flush(400);
    expect(service.page()).toBe(1);
  });

  it('cancels previous request via switchMap on new search', async () => {
    const slow$ = new Subject<CatalogProductListResponse>();
    const fastResponse = makeResponse([{ id: '2', title: 'Fast' }], 1, 1);

    mockGetProducts
      .mockReturnValueOnce(slow$)
      .mockReturnValueOnce(of(fastResponse));

    // First search: debounced at 300ms
    service.search('CPU', 'slow', 1, 12, 'ex');

    // Wait long enough for first debounce to fire (so switchMap subscribes to slow$)
    await flush(500);

    // Now slow$ is subscribed. Send second search to cancel it.
    service.search('CPU', 'fast', 1, 12, 'ex');
    await flush(500);

    // First request should be cancelled by switchMap, second should have results
    expect(service.items()).toHaveLength(1);
    expect(service.items()[0]!.id).toBe('2');

    // Emit on slow$ — should NOT update state (cancelled)
    slow$.next(makeResponse([{ id: '99', title: 'Slow result' }], 1, 1));
    expect(service.items()).toHaveLength(1);
    expect(service.items()[0]!.id).toBe('2');
    slow$.complete();
  });

  it('sets loading state during request', async () => {
    const response$ = new Subject<CatalogProductListResponse>();
    mockGetProducts.mockReturnValue(response$);

    service.search('CPU', '', 1, 12, 'ex');
    await flush(400);

    expect(service.loading()).toBe(true);

    response$.next(makeResponse([], 0, 0));
    response$.complete();
    await flush();

    expect(service.loading()).toBe(false);
  });

  it('sets error state on API failure', async () => {
    mockGetProducts.mockReturnValue(throwError(() => ({ message: 'Server error' })));

    service.search('CPU', '', 1, 12, 'ex');
    await flush(400);

    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('Server error');
    expect(service.items()).toEqual([]);
  });

  it('retries by re-calling search with same params', async () => {
    mockGetProducts
      .mockReturnValueOnce(throwError(() => ({ message: 'Fail' })))
      .mockReturnValueOnce(of(makeResponse([{ id: '1', title: 'OK' }], 1, 1)));

    service.search('CPU', 'query', 2, 12, 'ex');
    await flush(400);
    expect(service.error()).toBe('Fail');

    service.search('CPU', 'query', 2, 12, 'ex');
    await flush(400);

    expect(service.error()).toBeNull();
    expect(service.items()).toHaveLength(1);
    expect(mockGetProducts).toHaveBeenCalledTimes(2);
  });

  it('reset clears all state', async () => {
    mockGetProducts.mockReturnValue(
      of(makeResponse([{ id: '1', title: 'A' }], 5, 1)),
    );

    service.search('CPU', 'test', 1, 12, 'ex');
    await flush(400);
    expect(service.items()).toHaveLength(1);

    service.reset();

    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
    expect(service.items()).toEqual([]);
    expect(service.query()).toBe('');
    expect(service.page()).toBe(1);
  });

  it('exposes hasNextPage and hasPrevPage correctly', async () => {
    mockGetProducts.mockReturnValue(
      of(makeResponse([{ id: '1', title: 'A' }], 30, 3)),
    );

    service.search('CPU', '', 2, 12, 'ex');
    await flush(400);

    expect(service.hasNextPage()).toBe(true);
    expect(service.hasPrevPage()).toBe(true);
  });
});
