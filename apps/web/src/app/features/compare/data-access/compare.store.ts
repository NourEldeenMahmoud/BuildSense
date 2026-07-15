import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, catchError, of, forkJoin, tap, Observable, filter, map } from 'rxjs';
import { CatalogService } from '../../catalog/data-access/catalog.service';
import { parseCompareParams } from './compare-query.codec';
import { toViewModel } from '../../product/data-access/product-detail.store';
import type { CatalogProductDetail } from '../../../shared/contracts/catalog';
import type { ProductDetailViewModel } from '../../product/data-access/product-detail.store';
import type { CompareQueryState } from './compare-query.codec';

// ---------------------------------------------------------------------------
// Slot status
// ---------------------------------------------------------------------------

export type SlotStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'not-found'
  | 'api-error';

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

export interface CompareState {
  queryState: CompareQueryState;
  leftId: string | null;
  rightId: string | null;
  leftRaw: CatalogProductDetail | null;
  rightRaw: CatalogProductDetail | null;
  leftVm: ProductDetailViewModel | null;
  rightVm: ProductDetailViewModel | null;
  leftStatus: SlotStatus;
  rightStatus: SlotStatus;
  categoryMismatch: boolean;
}

const INITIAL_STATE: CompareState = {
  queryState: 'missing',
  leftId: null,
  rightId: null,
  leftRaw: null,
  rightRaw: null,
  leftVm: null,
  rightVm: null,
  leftStatus: 'idle',
  rightStatus: 'idle',
  categoryMismatch: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

@Injectable()
export class CompareStore {
  private readonly catalogService = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<CompareState>(INITIAL_STATE);
  private readonly retry$ = new Subject<void>();

  // Public selectors
  readonly queryState = computed(() => this.state().queryState);
  readonly leftId = computed(() => this.state().leftId);
  readonly rightId = computed(() => this.state().rightId);
  readonly leftVm = computed(() => this.state().leftVm);
  readonly rightVm = computed(() => this.state().rightVm);
  readonly leftStatus = computed(() => this.state().leftStatus);
  readonly rightStatus = computed(() => this.state().rightStatus);
  readonly leftRaw = computed(() => this.state().leftRaw);
  readonly rightRaw = computed(() => this.state().rightRaw);
  readonly categoryMismatch = computed(() => this.state().categoryMismatch);

  readonly loading = computed(() =>
    this.state().leftStatus === 'loading' || this.state().rightStatus === 'loading'
  );

  readonly loaded = computed(() =>
    this.state().leftStatus === 'loaded' && this.state().rightStatus === 'loaded'
  );

  readonly leftNotFound = computed(() => this.state().leftStatus === 'not-found');
  readonly rightNotFound = computed(() => this.state().rightStatus === 'not-found');
  readonly leftApiError = computed(() => this.state().leftStatus === 'api-error');
  readonly rightApiError = computed(() => this.state().rightStatus === 'api-error');

  readonly leftErrorMessage = computed(() => {
    const s = this.state();
    if (s.leftStatus === 'not-found') return 'Product not found.';
    if (s.leftStatus === 'api-error') return 'Failed to load product details.';
    return null;
  });

  readonly rightErrorMessage = computed(() => {
    const s = this.state();
    if (s.rightStatus === 'not-found') return 'Product not found.';
    if (s.rightStatus === 'api-error') return 'Failed to load product details.';
    return null;
  });

  readonly hasAnyError = computed(() =>
    this.leftNotFound() || this.rightNotFound() ||
    this.leftApiError() || this.rightApiError()
  );

  constructor() {
    this.setupRouteSubscription();
  }

  retry(): void {
    this.retry$.next();
  }

  private setupRouteSubscription(): void {
    const trigger$: Observable<{ left: string; right: string }> = new Observable((subscriber) => {
      let latestParams: { left: string; right: string } | null = null;

      const routeSub = this.route.queryParams
        .pipe(
          map((qp) => ({ left: (qp['left'] as string) ?? '', right: (qp['right'] as string) ?? '' })),
          filter((p) => p.left !== '' || p.right !== '')
        )
        .subscribe((p) => {
          latestParams = p;
          subscriber.next(p);
        });

      const retrySub = this.retry$.subscribe(() => {
        if (latestParams) {
          subscriber.next(latestParams);
        }
      });

      return () => {
        routeSub.unsubscribe();
        retrySub.unsubscribe();
      };
    });

    trigger$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(({ left, right }) => {
          const parsed = parseCompareParams(left || null, right || null);

          // Immediately reflect query validation state
          this.state.update((s) => ({
            ...s,
            queryState: parsed.state,
            leftId: parsed.leftId,
            rightId: parsed.rightId,
          }));

          if (parsed.state !== 'valid') {
            // Clear previous data on invalid state
            this.state.update((s) => ({
              ...s,
              leftRaw: null,
              rightRaw: null,
              leftVm: null,
              rightVm: null,
              leftStatus: 'idle',
              rightStatus: 'idle',
              categoryMismatch: false,
            }));
            return of(null);
          }

          // Loading state — clear previous products immediately
          this.state.update((s) => ({
            ...s,
            leftStatus: 'loading',
            rightStatus: 'loading',
            leftRaw: null,
            rightRaw: null,
            leftVm: null,
            rightVm: null,
            categoryMismatch: false,
          }));

          // Concurrent fetch with switchMap cancellation
          interface SlotResult {
            product: CatalogProductDetail | null;
            error: SlotStatus | null;
          }

          const fetchSlot = (id: string): Observable<SlotResult> =>
            this.catalogService.getProductById(id).pipe(
              map((product): SlotResult => ({ product, error: null })),
              catchError((err): Observable<SlotResult> => {
                const error: SlotStatus = err?.status === 404 ? 'not-found' : 'api-error';
                return of({ product: null, error });
              })
            );

          return forkJoin({
            left: fetchSlot(parsed.leftId!),
            right: fetchSlot(parsed.rightId!),
          }).pipe(
            tap(({ left, right }) => {
              const leftProduct = left.product;
              const rightProduct = right.product;
              const leftStatus: SlotStatus = left.product ? 'loaded' : (left.error ?? 'api-error');
              const rightStatus: SlotStatus = right.product ? 'loaded' : (right.error ?? 'api-error');

              // Category mismatch check (only when both loaded)
              const categoryMismatch =
                leftProduct !== null &&
                rightProduct !== null &&
                normalizeCategory(leftProduct.category) !== normalizeCategory(rightProduct.category);

              this.state.update((s) => ({
                ...s,
                leftRaw: leftProduct,
                rightRaw: rightProduct,
                leftVm: leftProduct ? toViewModel(leftProduct) : null,
                rightVm: rightProduct ? toViewModel(rightProduct) : null,
                leftStatus,
                rightStatus,
                categoryMismatch,
              }));
            })
          );
        })
      )
      .subscribe();
  }
}

/**
 * Conservative category normalization for equality check only.
 * Trims whitespace and lowercases — does NOT infer semantic equivalence.
 */
function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}
