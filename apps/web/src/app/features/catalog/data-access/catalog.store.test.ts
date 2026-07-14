import { TestBed } from '@angular/core/testing';
import { CatalogStore } from './catalog.store';
import { CatalogService } from './catalog.service';
import { CatalogQueryService } from './catalog-query.service';
import { Subject, of, throwError, delay, Observable } from 'rxjs';
import { vitest, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';

describe('CatalogStore', () => {
  let store: CatalogStore;
  let mockCatalogService: { getProducts: Mock };
  let mockQueryService: { queryParams$: Observable<Record<string, unknown>> };
  let queryParamsSubject: Subject<Record<string, unknown>>;

  beforeEach(() => {
    vitest.useFakeTimers();
    queryParamsSubject = new Subject<Record<string, unknown>>();

    mockCatalogService = {
      getProducts: vitest.fn().mockReturnValue(of({ items: [], pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 } }))
    };

    mockQueryService = {
      queryParams$: queryParamsSubject.asObservable()
    };

    TestBed.configureTestingModule({
      providers: [
        CatalogStore,
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: CatalogQueryService, useValue: mockQueryService }
      ]
    });
  });

  afterEach(() => {
    vitest.useRealTimers();
  });

  it('should initialize with empty state', () => {
    store = TestBed.inject(CatalogStore);
    expect(store.query()).toBeNull();
    expect(store.result()).toBeNull();
    expect(store.initialLoading()).toBe(false);
    expect(store.backgroundLoading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.empty()).toBe(false); // result is null, so empty is false
  });

  it('should transition to initialLoading then success on first query', async () => {
    store = TestBed.inject(CatalogStore);
    
    // Setup delayed response to observe loading state
    const response = { items: [{ id: '1', title: 'Product 1' }], pagination: { page: 1, pageSize: 24, totalItems: 1, totalPages: 1 } };
    mockCatalogService.getProducts.mockReturnValue(of(response).pipe(delay(100)));

    queryParamsSubject.next({ page: 1, search: 'test' });
    
    // Advance timers so that switchMap executes the delayed observable
    await vitest.advanceTimersByTimeAsync(0);

    expect(store.initialLoading()).toBe(true);
    expect(store.backgroundLoading()).toBe(false);
    expect(store.query()).toEqual({ page: 1, search: 'test' });
    expect(store.result()).toBeNull();

    await vitest.advanceTimersByTimeAsync(100);

    expect(store.initialLoading()).toBe(false);
    expect(store.backgroundLoading()).toBe(false);
    expect(store.result()).toEqual(response);
    expect(store.empty()).toBe(false);
  });

  it('should transition to backgroundLoading on subsequent queries', async () => {
    store = TestBed.inject(CatalogStore);
    
    // First request
    const response1 = { items: [{ id: '1' }], pagination: { page: 1, pageSize: 24, totalItems: 1, totalPages: 1 } };
    mockCatalogService.getProducts.mockReturnValue(of(response1));
    queryParamsSubject.next({ page: 1 });
    await vitest.advanceTimersByTimeAsync(0);

    // Store is populated
    expect(store.result()).toEqual(response1);

    // Second request
    const response2 = { items: [{ id: '1'}, { id: '2' }], pagination: { page: 1, pageSize: 24, totalItems: 2, totalPages: 1 } };
    mockCatalogService.getProducts.mockReturnValue(of(response2).pipe(delay(100)));
    queryParamsSubject.next({ page: 1, search: 'rtx' });
    await vitest.advanceTimersByTimeAsync(0);

    expect(store.initialLoading()).toBe(false);
    expect(store.backgroundLoading()).toBe(true);
    expect(store.result()).toEqual(response1); // stale data remains

    await vitest.advanceTimersByTimeAsync(100);

    expect(store.backgroundLoading()).toBe(false);
    expect(store.result()).toEqual(response2);
  });

  it('should handle API errors and retry', async () => {
    store = TestBed.inject(CatalogStore);
    
    mockCatalogService.getProducts.mockReturnValue(throwError(() => new Error('Network error')));
    queryParamsSubject.next({ page: 1 });
    await vitest.advanceTimersByTimeAsync(0);

    expect(store.initialLoading()).toBe(false);
    expect(store.error()).toBe('Network error');

    // Retry success
    const response = { items: [], pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 } };
    mockCatalogService.getProducts.mockReturnValue(of(response));
    
    store.retry();
    await vitest.advanceTimersByTimeAsync(0);

    expect(store.error()).toBeNull();
    expect(store.result()).toEqual(response);
    expect(store.empty()).toBe(true);
  });

  it('should cancel stale requests (stale-request protection)', async () => {
    store = TestBed.inject(CatalogStore);
    
    // Request A (takes 200ms)
    mockCatalogService.getProducts.mockImplementation((params: Record<string, unknown>) => {
      if (params['search'] === 'A') {
        return of({ items: [{ id: 'A' }] }).pipe(delay(200));
      }
      // Request B (takes 100ms)
      if (params['search'] === 'B') {
        return of({ items: [{ id: 'B' }] }).pipe(delay(100));
      }
      return of(null);
    });

    queryParamsSubject.next({ page: 1, search: 'A' });
    await vitest.advanceTimersByTimeAsync(50); // A is still pending
    
    // Start B before A finishes
    queryParamsSubject.next({ page: 1, search: 'B' });
    
    await vitest.advanceTimersByTimeAsync(100); // B finishes. 150ms total elapsed, A has not resolved.
    
    expect(store.result()).toEqual({ items: [{ id: 'B' }] });

    await vitest.advanceTimersByTimeAsync(100); // A finishes now.
    
    // Store should STILL be B, A should have been cancelled by switchMap
    expect(store.result()).toEqual({ items: [{ id: 'B' }] });
    expect(mockCatalogService.getProducts).toHaveBeenCalledTimes(2);
  });

  it('should prevent N+1 requests - only fetch list once per query update', async () => {
    store = TestBed.inject(CatalogStore);
    
    const response = { items: [{ id: '1' }, { id: '2' }], pagination: { page: 1, pageSize: 24, totalItems: 2, totalPages: 1 } };
    mockCatalogService.getProducts.mockReturnValue(of(response));

    queryParamsSubject.next({ page: 1 });
    await vitest.advanceTimersByTimeAsync(0);

    expect(mockCatalogService.getProducts).toHaveBeenCalledTimes(1);
    
    // Data is loaded, items are rendered.
    // Assert NO fetch for product details or offers were made automatically.
    // mockCatalogService has no such methods mocked or called, but let's assert standard call count.
    expect(mockCatalogService.getProducts).toHaveBeenCalledTimes(1);
    expect(store.result()?.items.length).toBe(2);
  });
});
