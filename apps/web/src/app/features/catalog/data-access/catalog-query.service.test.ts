import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { describe, it, expect, beforeEach, vi as vitest } from 'vitest';
import { CatalogQueryService } from './catalog-query.service';
import { BehaviorSubject, firstValueFrom, take } from 'rxjs';

describe('CatalogQueryService', () => {
  let service: CatalogQueryService;
  let router: Router;
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;

  beforeEach(() => {
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});
    
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        CatalogQueryService,
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParamsSubject.asObservable(),
            snapshot: {
              queryParams: {}
            }
          }
        }
      ]
    });

    service = TestBed.inject(CatalogQueryService);
    router = TestBed.inject(Router);
  });

  it('should parse default values when no params present', async () => {
    const params = await firstValueFrom(service.queryParams$.pipe(take(1)));
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(24);
    expect(params.search).toBeUndefined();
  });

  it('should parse valid numbers and string params', async () => {
    queryParamsSubject.next({
      page: '3',
      pageSize: '50',
      search: 'rtx',
      minPrice: '100.50',
      sort: 'price_asc'
    });

    const params = await firstValueFrom(service.queryParams$.pipe(take(1)));
    expect(params.page).toBe(3);
    expect(params.pageSize).toBe(50);
    expect(params.search).toBe('rtx');
    expect(params.minPrice).toBe(100.50);
    expect(params.sort).toBe('price_asc');
  });

  it('should normalize invalid numeric values and bounds', async () => {
    queryParamsSubject.next({
      page: '-5',
      pageSize: '500', // max 100
      minPrice: '100',
      maxPrice: '50', // less than minPrice
      sort: 'invalid_sort'
    });

    const params = await firstValueFrom(service.queryParams$.pipe(take(1)));
    expect(params.page).toBe(1); // default
    expect(params.pageSize).toBe(100); // capped
    expect(params.minPrice).toBeUndefined(); // dropped because > maxPrice
    expect(params.maxPrice).toBe(50); // kept
    expect(params.sort).toBeUndefined(); // dropped invalid sort
  });

  it('should reset page when filters change', () => {
    const navigateSpy = vitest.spyOn(router, 'navigate');
    
    const filtersThatResetPage = [
      { search: 'new' },
      { category: 'new-cat' },
      { brand: 'new-brand' },
      { minPrice: 100 },
      { maxPrice: 500 },
      { sort: 'newest' as const },
      { pageSize: 50 }
    ];

    for (const filter of filtersThatResetPage) {
      TestBed.inject(ActivatedRoute).snapshot.queryParams = { page: '3' };
      service.updateFilters(filter);

      const args = navigateSpy.mock.calls[navigateSpy.mock.calls.length - 1]![1] as Record<string, unknown>;
      const queryParams = args['queryParams'] as Record<string, unknown>;
      expect(queryParams['page']).toBeUndefined(); // Omitted because it resets to the default 1
    }
  });

  it('should not reset page when only page changes', () => {
    const navigateSpy = vitest.spyOn(router, 'navigate');
    
    // Simulate current state is page 3 with search 'intel'
    TestBed.inject(ActivatedRoute).snapshot.queryParams = { page: '3', search: 'intel' };

    service.updateFilters({ page: 4 });

    const args = navigateSpy.mock.calls[0]![1] as Record<string, unknown>;
    const queryParams = args['queryParams'] as Record<string, unknown>;
    expect(queryParams['page']).toBe(4);
    expect(queryParams['search']).toBe('intel');
  });

  it('should debounce update filters', async () => {
    vitest.useFakeTimers();
    const navigateSpy = vitest.spyOn(router, 'navigate');

    TestBed.inject(ActivatedRoute).snapshot.queryParams = { search: 'old' };

    service.debounceUpdateFilters({ search: 'a' });
    service.debounceUpdateFilters({ search: 'ab' });
    service.debounceUpdateFilters({ search: 'abc' });

    // Should not have navigated yet
    expect(navigateSpy).not.toHaveBeenCalled();

    // Fast-forward 300ms
    vitest.advanceTimersByTime(300);

    // Should have navigated once with the combined latest filters
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const args = navigateSpy.mock.calls[0]![1] as Record<string, unknown>;
    const queryParams = args['queryParams'] as Record<string, unknown>;
    expect(queryParams['search']).toBe('abc');

    vitest.useRealTimers();
  });
});
