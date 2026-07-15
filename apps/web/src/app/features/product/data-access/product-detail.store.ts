import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, catchError, of, tap, map, Observable, filter } from 'rxjs';
import { CatalogService } from '../../catalog/data-access/catalog.service';
import type {
  CatalogProductDetail,
  CatalogProductOffer,
  RawSpecification,
} from '../../../shared/contracts/catalog';

// ---------------------------------------------------------------------------
// Availability helper
// ---------------------------------------------------------------------------

/**
 * Conservative availability check.
 * An offer is considered "available" only when the availability text
 * explicitly contains "IN_STOCK". We never fabricate stock status.
 */
export function isOfferAvailable(offer: CatalogProductOffer): boolean {
  return offer.availability === 'IN_STOCK';
}

/**
 * Check whether an offer has a valid (non-null, non-negative) price.
 */
export function hasValidPrice(offer: CatalogProductOffer): boolean {
  return offer.price !== null && offer.price >= 0;
}

// ---------------------------------------------------------------------------
// Deterministic current offer selection
// ---------------------------------------------------------------------------

/**
 * Select the current offer deterministically:
 * 1. Among available offers (IN_STOCK), choose the lowest valid price.
 * 2. If none available, among all offers, choose the lowest valid price.
 * 3. If no offer has a valid price, use the first returned offer as fallback.
 *
 * Array order is only used as the final fallback tiebreaker.
 */
export function selectCurrentOffer(offers: CatalogProductOffer[]): CatalogProductOffer | null {
  if (!offers || offers.length === 0) return null;

  const available = offers.filter(isOfferAvailable);
  const withPrice = (available.length > 0 ? available : offers).filter(hasValidPrice);

  if (withPrice.length > 0) {
    // Only compare by price; preserve original index for equal prices via reduce
    return withPrice.reduce((best, cur) =>
      cur.price! < best.price! ? cur : best
    );
  }

  // No offer has a valid price — return first as fallback
  return offers[0]!;
}

// ---------------------------------------------------------------------------
// View Model
// ---------------------------------------------------------------------------

export interface ProductOfferViewModel {
  id: string;
  storeCode: string;
  price: number | null;
  currency: string;
  availability: string;
  sourceUrl: string | null;
}

export interface ProductDetailViewModel {
  id: string;
  title: string;
  category: string;
  brand: string | null;
  model: string | null;
  mpn: string | null;
  images: string[];
  primaryImageUrl: string | null;
  rawSpecifications: RawSpecification[];
  currentOffer: ProductOfferViewModel | null;
  availabilityText: string;
  sourceUrl: string | null;
  allOffers: ProductOfferViewModel[];
  hasMultipleOffers: boolean;
}

export function toViewModel(product: CatalogProductDetail): ProductDetailViewModel {
  const currentOffer = selectCurrentOffer(product.offers);
  const primaryImageUrl =
    product.images && product.images.length > 0 ? product.images[0]! : null;

  return {
    id: product.id,
    title: product.title,
    category: product.category,
    brand: product.brand,
    model: product.model,
    mpn: product.mpn,
    images: product.images ?? [],
    primaryImageUrl,
    rawSpecifications: product.rawSpecifications ?? [],
    currentOffer: currentOffer
      ? {
          id: currentOffer.id,
          storeCode: currentOffer.storeCode,
          price: currentOffer.price,
          currency: currentOffer.currency,
          availability: currentOffer.availability,
          sourceUrl: currentOffer.sourceUrl,
        }
      : null,
    availabilityText: currentOffer?.availability ?? 'Availability unknown',
    sourceUrl: currentOffer?.sourceUrl ?? null,
    allOffers: product.offers.map((o) => ({
      id: o.id,
      storeCode: o.storeCode,
      price: o.price,
      currency: o.currency,
      availability: o.availability,
      sourceUrl: o.sourceUrl,
    })),
    hasMultipleOffers: product.offers.length > 1,
  };
}

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

export type ProductDetailStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'invalid-id'
  | 'not-found'
  | 'api-error';

export interface ProductDetailState {
  status: ProductDetailStatus;
  productId: string | null;
  rawProduct: CatalogProductDetail | null;
  viewModel: ProductDetailViewModel | null;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// ID validation — matches the backend pattern
// ---------------------------------------------------------------------------

function isValidProductId(id: string | null): id is string {
  return typeof id === 'string' && id.length > 0;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

@Injectable()
export class ProductDetailStore {
  private readonly catalogService = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<ProductDetailState>({
    status: 'idle',
    productId: null,
    rawProduct: null,
    viewModel: null,
    errorMessage: null,
  });

  // Public selectors
  readonly status = computed(() => this.state().status);
  readonly productId = computed(() => this.state().productId);
  readonly viewModel = computed(() => this.state().viewModel);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly loading = computed(() => this.state().status === 'loading');
  readonly loaded = computed(() => this.state().status === 'loaded');
  readonly invalidId = computed(() => this.state().status === 'invalid-id');
  readonly notFound = computed(() => this.state().status === 'not-found');
  readonly apiError = computed(() => this.state().status === 'api-error');

  private readonly retry$ = new Subject<void>();

  constructor() {
    this.setupRouteSubscription();
  }

  private setupRouteSubscription(): void {
    // Build a trigger observable that re-emits the latest params on retry
    const trigger$: Observable<string> = new Observable<string>((subscriber) => {
      let latestId: string | null = null;

      const routeSub = this.route.paramMap
        .pipe(
          map((params) => params.get('productId')),
          filter((id): id is string => id !== null)
        )
        .subscribe((id) => {
          latestId = id;
          subscriber.next(id);
        });

      const retrySub = this.retry$.subscribe(() => {
        if (latestId) {
          subscriber.next(latestId);
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
        switchMap((productId) => {
          if (!isValidProductId(productId)) {
            this.state.update((s) => ({
              ...s,
              status: 'invalid-id',
              productId,
              rawProduct: null,
              viewModel: null,
              errorMessage: 'Invalid product ID.',
            }));
            return of(null);
          }

          // Loading state — clear previous product immediately
          this.state.update((s) => ({
            ...s,
            status: 'loading',
            productId,
            rawProduct: null,
            viewModel: null,
            errorMessage: null,
          }));

          return this.catalogService.getProductById(productId).pipe(
            tap((product) => {
              const vm = toViewModel(product);
              this.state.update((s) => ({
                ...s,
                status: 'loaded',
                productId,
                rawProduct: product,
                viewModel: vm,
                errorMessage: null,
              }));
            }),
            catchError((err) => {
              const status = err?.status === 404 ? 'not-found' : 'api-error';
              const message =
                err?.status === 404
                  ? 'Product not found.'
                  : err?.error?.message ||
                    err?.message ||
                    'Failed to load product details.';
              this.state.update((s) => ({
                ...s,
                status,
                productId,
                rawProduct: null,
                viewModel: null,
                errorMessage: message,
              }));
              return of(null);
            })
          );
        })
      )
      .subscribe();
  }

  retry(): void {
    this.retry$.next();
  }
}
