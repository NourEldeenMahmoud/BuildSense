import { Injectable, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { map, Observable, distinctUntilChanged, Subject, debounceTime } from 'rxjs';
import { CatalogQueryParams } from './catalog.service';

@Injectable({
  providedIn: 'root'
})
export class CatalogQueryService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  
  private filterUpdates = new Subject<void>();
  private pendingFilters: Partial<CatalogQueryParams> = {};

  constructor() {
    this.filterUpdates.pipe(
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      const filtersToApply = { ...this.pendingFilters };
      this.pendingFilters = {};
      this.updateFilters(filtersToApply);
    });
  }

  /**
   * Returns an Observable of parsed and normalized CatalogQueryParams.
   * Invalid numerics are rejected/normalized.
   */
  get queryParams$(): Observable<CatalogQueryParams> {
    return this.route.queryParams.pipe(
      map(params => this.parseParams(params)),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    );
  }

  /**
   * Updates the URL query parameters immediately.
   * Reset page to 1 when any result-changing value changes.
   */
  updateFilters(newFilters: Partial<CatalogQueryParams>): void {
    const currentParams = this.parseParams(this.route.snapshot.queryParams);
    const updatedParams = { ...currentParams, ...newFilters };

    // Reset page to 1 when any result-changing value changes:
    // search, category, brand, minPrice, maxPrice, sort, pageSize if it changes
    const filtersChanged = 
      (newFilters.search !== undefined && newFilters.search !== currentParams.search) ||
      (newFilters.category !== undefined && newFilters.category !== currentParams.category) ||
      (newFilters.brand !== undefined && newFilters.brand !== currentParams.brand) ||
      (newFilters.minPrice !== undefined && newFilters.minPrice !== currentParams.minPrice) ||
      (newFilters.maxPrice !== undefined && newFilters.maxPrice !== currentParams.maxPrice) ||
      (newFilters.sort !== undefined && newFilters.sort !== currentParams.sort) ||
      (newFilters.pageSize !== undefined && newFilters.pageSize !== currentParams.pageSize);

    if (filtersChanged && newFilters.page === undefined) {
      updatedParams.page = 1;
    }

    // Clean up undefined/null values for the URL
    const queryParams = this.toQueryParams(updatedParams);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'replace'
    });
  }

  /**
   * Removes specific keys from the URL query parameters.
   * Unlike updateFilters({}), calling this method explicitly deletes keys
   * instead of merging an empty object that would leave existing keys intact.
   * Always resets page to 1 when any result-changing filter is removed.
   */
  removeFilters(keys: ('search' | 'category' | 'brand' | 'minPrice' | 'maxPrice' | 'sort' | 'pageSize')[]): void {
    const currentParams = this.parseParams(this.route.snapshot.queryParams);
    const updatedParams = { ...currentParams };
    let hasChanges = false;
    for (const key of keys) {
      if (key in updatedParams) {
        delete (updatedParams as Record<string, unknown>)[key];
        hasChanges = true;
      }
    }
    if (!hasChanges) return;
    // Reset to page 1 since filters changed
    updatedParams.page = 1;
    const queryParams = this.toQueryParams(updatedParams);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'replace'
    });
  }

  /**
   * Debounces updates to the URL query parameters to avoid navigation spam.
   */
  debounceUpdateFilters(newFilters: Partial<CatalogQueryParams>): void {
    this.pendingFilters = { ...this.pendingFilters, ...newFilters };
    this.filterUpdates.next();
  }

  private toQueryParams(updatedParams: CatalogQueryParams): Params {
    const queryParams: Params = {};
    if (updatedParams.page && updatedParams.page > 1) queryParams['page'] = updatedParams.page;
    if (updatedParams.pageSize && updatedParams.pageSize !== 24) queryParams['pageSize'] = updatedParams.pageSize;
    if (updatedParams.search) queryParams['search'] = updatedParams.search;
    if (updatedParams.category) queryParams['category'] = updatedParams.category;
    if (updatedParams.brand) queryParams['brand'] = updatedParams.brand;
    if (updatedParams.minPrice !== undefined) queryParams['minPrice'] = updatedParams.minPrice;
    if (updatedParams.maxPrice !== undefined) queryParams['maxPrice'] = updatedParams.maxPrice;
    if (updatedParams.sort) queryParams['sort'] = updatedParams.sort;
    return queryParams;
  }

  private parseParams(params: Params): CatalogQueryParams {
    const parsed: CatalogQueryParams = {
      page: 1,
      pageSize: 24
    };

    if (params['page']) {
      const page = parseInt(params['page'], 10);
      if (!isNaN(page)) {
        parsed.page = page < 1 ? 1 : page;
      }
    }

    if (params['pageSize']) {
      const pageSize = parseInt(params['pageSize'], 10);
      if (!isNaN(pageSize)) {
        parsed.pageSize = pageSize < 1 ? 24 : (pageSize > 100 ? 100 : pageSize);
      }
    }

    if (typeof params['search'] === 'string' && params['search'].trim()) {
      parsed.search = params['search'].trim();
    }
    
    if (typeof params['category'] === 'string' && params['category'].trim()) {
      parsed.category = params['category'].trim();
    }
    
    if (typeof params['brand'] === 'string' && params['brand'].trim()) {
      parsed.brand = params['brand'].trim();
    }

    if (params['minPrice']) {
      const minPrice = parseFloat(params['minPrice']);
      if (!isNaN(minPrice) && isFinite(minPrice) && minPrice >= 0) {
        parsed.minPrice = minPrice;
      }
    }

    if (params['maxPrice']) {
      const maxPrice = parseFloat(params['maxPrice']);
      if (!isNaN(maxPrice) && isFinite(maxPrice) && maxPrice >= 0) {
        parsed.maxPrice = maxPrice;
      }
    }

    if (parsed.minPrice !== undefined && parsed.maxPrice !== undefined && parsed.minPrice > parsed.maxPrice) {
      delete parsed.minPrice;
    }

    if (params['sort']) {
      const sort = params['sort'];
      if (sort === 'price_asc' || sort === 'price_desc' || sort === 'newest') {
        parsed.sort = sort;
      }
    }

    return parsed;
  }
}
