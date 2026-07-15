import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, catchError, of, tap, debounceTime, map } from 'rxjs';
import { CatalogService } from '../../catalog/data-access/catalog.service';
import type { CatalogProductListItem } from '../../../shared/contracts/catalog';

// ---------------------------------------------------------------------------
// Search state
// ---------------------------------------------------------------------------

export interface CandidateSearchState {
  query: string;
  page: number;
  pageSize: number;
  category: string;
  excludeId: string | null;
  items: CatalogProductListItem[];
  totalItems: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Candidate Search Service
//
// Manages server-side category-filtered search for the comparison selector.
// Supports debounced text search, pagination, and exclusion of a fixed
// product ID (slot A).  All requests are cancelled by switchMap on new
// inputs.
// ---------------------------------------------------------------------------

@Injectable()
export class CompareCandidateSearchService {
  private readonly catalogService = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchInput$ = new Subject<{
    category: string;
    search: string;
    page: number;
    pageSize: number;
    excludeId: string;
  }>();

  private readonly state = signal<CandidateSearchState>({
    query: '',
    page: 1,
    pageSize: 12,
    category: '',
    excludeId: null,
    items: [],
    totalItems: 0,
    totalPages: 0,
    loading: false,
    error: null,
  });

  // Public selectors
  readonly items = computed(() => this.state().items);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly page = computed(() => this.state().page);
  readonly pageSize = computed(() => this.state().pageSize);
  readonly totalItems = computed(() => this.state().totalItems);
  readonly totalPages = computed(() => this.state().totalPages);
  readonly query = computed(() => this.state().query);
  readonly category = computed(() => this.state().category);
  readonly hasNextPage = computed(() => this.state().page < this.state().totalPages);
  readonly hasPrevPage = computed(() => this.state().page > 1);

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          this.state.update((s) => ({
            ...s,
            loading: true,
            error: null,
            query: params.search,
            page: params.page,
            category: params.category,
            excludeId: params.excludeId,
          }));

          const catalogParams: { category: string; page: number; pageSize: number; search?: string } = {
            category: params.category,
            page: params.page,
            pageSize: params.pageSize,
          };
          if (params.search) {
            catalogParams.search = params.search;
          }

          return this.catalogService
            .getProducts(catalogParams)
            .pipe(
              map((response) => ({
                items: response.items.filter(
                  (item) => item.id !== params.excludeId
                ),
                totalItems: response.pagination.totalItems,
                totalPages: response.pagination.totalPages,
              })),
              tap((filtered) => {
                this.state.update((s) => ({
                  ...s,
                  items: filtered.items,
                  totalItems: filtered.totalItems,
                  totalPages: filtered.totalPages,
                  loading: false,
                }));
              }),
              catchError((err) => {
                const message =
                  err?.error?.message || err?.message || 'Failed to search products.';
                this.state.update((s) => ({
                  ...s,
                  items: [],
                  totalItems: 0,
                  totalPages: 0,
                  loading: false,
                  error: message,
                }));
                return of(null);
              })
            );
        })
      )
      .subscribe();
  }

  /**
   * Initiate or update a search. Debounced internally.
   */
  search(
    category: string,
    query: string,
    page: number,
    pageSize: number,
    excludeId: string
  ): void {
    this.searchInput$.next({ category, search: query, page, pageSize, excludeId });
  }

  /**
   * Reset the service state when the selector is closed/reopened.
   */
  reset(): void {
    this.state.set({
      query: '',
      page: 1,
      pageSize: 12,
      category: '',
      excludeId: null,
      items: [],
      totalItems: 0,
      totalPages: 0,
      loading: false,
      error: null,
    });
  }
}
