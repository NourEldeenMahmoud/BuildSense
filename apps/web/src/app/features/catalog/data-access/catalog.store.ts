import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, catchError, of, tap, Observable } from 'rxjs';
import { CatalogService, CatalogQueryParams } from './catalog.service';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogProductListItem } from '../../../shared/contracts/catalog';

interface CatalogState {
  query: CatalogQueryParams | null;
  result: {
    items: CatalogProductListItem[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    }
  } | null;
  initialLoading: boolean;
  backgroundLoading: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly catalogService = inject(CatalogService);
  private readonly catalogQueryService = inject(CatalogQueryService);
  private readonly destroyRef = inject(DestroyRef);

  // State
  private readonly state = signal<CatalogState>({
    query: null,
    result: null,
    initialLoading: false,
    backgroundLoading: false,
    error: null
  });

  // Selectors
  readonly query = computed(() => this.state().query);
  readonly result = computed(() => this.state().result);
  readonly initialLoading = computed(() => this.state().initialLoading);
  readonly backgroundLoading = computed(() => this.state().backgroundLoading);
  readonly error = computed(() => this.state().error);
  
  readonly empty = computed(() => {
    const res = this.result();
    return res !== null && res.items.length === 0;
  });

  // Actions
  private readonly retry$ = new Subject<void>();

  constructor() {
    const trigger$: Observable<CatalogQueryParams> = new Observable<CatalogQueryParams>(subscriber => {
      // Whenever query params change, emit them. Also re-emit the latest on retry.
      let latestParams: CatalogQueryParams | null = null;
      
      const querySub = this.catalogQueryService.queryParams$.subscribe(params => {
        latestParams = params;
        subscriber.next(params);
      });

      const retrySub = this.retry$.subscribe(() => {
        if (latestParams) {
          subscriber.next(latestParams);
        }
      });

      return () => {
        querySub.unsubscribe();
        retrySub.unsubscribe();
      };
    });

    trigger$.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((params) => {
        // Set loading state
        const isInitial = this.state().result === null;
        this.state.update(s => ({
          ...s,
          query: params,
          initialLoading: isInitial,
          backgroundLoading: !isInitial,
          error: null
        }));

        // Fetch
        return this.catalogService.getProducts(params).pipe(
          tap((result) => {
            this.state.update(s => ({
              ...s,
              result,
              initialLoading: false,
              backgroundLoading: false,
              error: null
            }));
          }),
          catchError(err => {
            const errorMessage = err?.error?.message || err?.message || 'Failed to load catalog';
            this.state.update(s => ({
              ...s,
              initialLoading: false,
              backgroundLoading: false,
              error: errorMessage
            }));
            return of(null);
          })
        );
      })
    ).subscribe();
  }

  retry(): void {
    this.retry$.next();
  }
}
