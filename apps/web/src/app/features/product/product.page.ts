import { Component, ChangeDetectionStrategy, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, Observable, switchMap, take, tap, throwError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductDetailStore } from './data-access/product-detail.store';
import { ProductGalleryComponent } from './ui/product-gallery.component';
import { ProductSpecsComponent } from './ui/product-specs.component';
import { ProductOffersComponent } from './ui/product-offers.component';
import { CompareSelectorComponent } from '../compare/ui/compare-selector.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { BuildService } from '../builder/data-access/build.service';
import { getLatestBuildId, setLatestBuildId } from '../../core/storage';
import type { BuildDto, BuildSlotName } from '@buildsense/contracts';

const CATEGORY_SLOT_MAP: Readonly<Record<string, BuildSlotName>> = {
  cpu: 'cpu',
  motherboard: 'motherboard',
  ram: 'ram',
  gpu: 'gpu',
  storage: 'storage',
  psu: 'psu',
  case: 'case',
};

@Component({
  selector: 'app-product',
  standalone: true,
  providers: [ProductDetailStore],
  imports: [
    CommonModule,
    RouterLink,
    ProductGalleryComponent,
    ProductSpecsComponent,
    ProductOffersComponent,
    CompareSelectorComponent,
    ErrorStateComponent,
  ],
  template: `
    <div class="product-page">
      <!-- Loading state -->
      @if (store.loading()) {
        <div class="product-loading" role="status" aria-label="Loading product details">
          <div class="loading-spinner" aria-hidden="true"></div>
          <span class="loading-text tech-font">Loading product details…</span>
        </div>
      }

      <!-- Invalid ID state -->
      @if (store.invalidId()) {
        <app-error-state
          title="Invalid Product"
          message="The product ID in the URL is not valid.">
        </app-error-state>
      }

      <!-- Not found state -->
      @if (store.notFound()) {
        <app-error-state
          title="Product Not Found"
          [message]="store.errorMessage() || 'The requested product could not be found.'">
        </app-error-state>
      }

      <!-- API error state -->
      @if (store.apiError()) {
        <app-error-state
          title="Error Loading Product"
          [message]="store.errorMessage() || 'An unexpected error occurred.'"
          [showRetry]="true"
          (onRetry)="store.retry()">
        </app-error-state>
      }

      <!-- Loaded state -->
      @if (store.loaded() && vm()) {
        <nav class="product-back" aria-label="Breadcrumb">
          <a routerLink="/" [queryParams]="{ category: vm()!.category }" class="product-back-link tech-font">
            <span aria-hidden="true">←</span>
            Back to catalog
          </a>
        </nav>

        <div class="product-layout">
          <div class="product-gallery-col">
            <app-product-gallery
              [images]="vm()!.images"
              [altText]="vm()!.title">
            </app-product-gallery>
          </div>

          <div class="product-details-col">
            <div class="product-meta tech-font">
              <span class="product-category-badge">{{ vm()!.category }}</span>
              @if (vm()!.mpn) {
                <span class="product-mpn">MPN: {{ vm()!.mpn }}</span>
              }
              @if (vm()!.model) {
                <span class="product-model">{{ vm()!.model }}</span>
              }
            </div>

            <h1 class="product-title">{{ vm()!.title }}</h1>

            <div class="price-panel">
              @if (vm()!.currentOffer?.price !== null && vm()!.currentOffer?.price !== undefined && vm()!.currentOffer!.price! >= 0) {
                <div class="current-price" [attr.aria-label]="vm()!.currentOffer!.price + ' ' + vm()!.currentOffer!.currency">
                  <span class="price-amount">{{ vm()!.currentOffer!.price! | number:'1.0-0' }}</span>
                  <span class="price-currency tech-font">{{ vm()!.currentOffer!.currency }}</span>
                </div>
              } @else {
                <div class="price-unavailable tech-font" aria-label="Price unavailable">Price unavailable</div>
              }
            </div>

            <div class="product-status-stack">
              <div class="status-panel">
                <span
                  class="status-indicator tech-font"
                  [class.status-success]="vm()!.currentOffer?.availability === 'IN_STOCK'"
                  [class.status-warning]="vm()!.currentOffer && vm()!.currentOffer!.availability !== 'IN_STOCK' && vm()!.currentOffer!.availability !== 'OUT_OF_STOCK'">
                  {{ availabilityLabel }}
                </span>
                <div class="status-detail">
                  <span>Available at</span>
                  <strong class="tech-font">{{ vm()!.currentOffer?.storeCode || 'Store unavailable' }}</strong>
                </div>
              </div>

              <div class="status-panel eligibility-panel" [class.status-blocked]="!canAddToBuilder()">
                <div class="status-label tech-font">
                  <span class="material-symbols-outlined" aria-hidden="true">memory</span>
                  Builder compatibility
                </div>
                <strong class="eligibility-value tech-font">
                  @if (canAddToBuilder()) {
                    Eligible component
                  } @else if (isBundle()) {
                    Bundle — catalog only
                  } @else {
                    Category not supported
                  }
                </strong>
              </div>
            </div>

            <div class="product-actions">
              <div class="primary-actions">
                @if (canAddToBuilder()) {
                  <button
                    type="button"
                    class="action-button action-button-primary"
                    [disabled]="addingToBuilder()"
                    aria-label="Add this product to Builder"
                    (click)="addToBuilder()">
                    <span aria-hidden="true">+</span>
                    {{ addingToBuilder() ? 'Adding...' : 'Add to build' }}
                  </button>
                }
                <button
                  type="button"
                  class="action-button action-button-compare"
                  [disabled]="!canCompare()"
                  [attr.aria-label]="canCompare() ? 'Compare this product with another' : 'Compare requires a valid product category'"
                  (click)="openCompareSelector()">
                  <span class="material-symbols-outlined" aria-hidden="true">compare_arrows</span>
                  Compare
                </button>
              </div>

              @if (!canAddToBuilder()) {
                <div class="action-unavailable-note tech-font">
                  {{ isBundle() ? 'Bundles contain multiple components and cannot be selected as a single Builder part.' : 'This product category cannot be selected in the Builder.' }}
                </div>
              }
              @if (addToBuilderError()) {
                <div class="action-error tech-font" role="alert">{{ addToBuilderError() }}</div>
              }

              @if (vm()!.currentOffer?.sourceUrl) {
                <a
                  class="source-link tech-font"
                  [href]="vm()!.currentOffer!.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  [attr.aria-label]="'View ' + vm()!.title + ' on Sigma store (opens in new tab)'">
                  Open at {{ vm()!.currentOffer!.storeCode }}
                  <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>
                </a>
              }
            </div>

            @if (!vm()!.currentOffer) {
              <div class="no-offer-note tech-font">No pricing information available for this product.</div>
            }

            <p class="product-note tech-font">
              Prices are captured from the source store and may vary at checkout. Verify specifications before final assembly.
            </p>
          </div>
        </div>

        <!-- All offers section (only when > 1) -->
        @if (vm()!.hasMultipleOffers) {
          <app-product-offers [offers]="vm()!.allOffers"></app-product-offers>
        }

        <app-product-specs [specs]="vm()!.rawSpecifications"></app-product-specs>
      }

      <!-- Compare selector overlay -->
      <bs-compare-selector
        [isOpen]="compareSelectorOpen()"
        [category]="vm()?.category ?? ''"
        [currentProductId]="vm()?.id ?? ''"
        [currentProductTitle]="vm()?.title ?? ''"
        targetSide="right"
        (productSelected)="onCompareProductSelected($event)"
        (closed)="compareSelectorOpen.set(false)">
      </bs-compare-selector>
    </div>
  `,
  styles: [`
    :host { display: block; margin-top: -24px; }
    .product-page { width: 100%; padding-bottom: 56px; }
    .product-loading { display: flex; min-height: 400px; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
    .loading-text { color: var(--color-on-surface-variant); font-size: 13px; }
    .loading-spinner { width: 48px; height: 48px; border: 3px solid var(--color-surface-container-high); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .product-back { margin-bottom: 24px; }
    .product-back-link { display: inline-flex; align-items: center; gap: 8px; color: var(--color-on-surface-variant); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; transition: color 0.2s, transform 0.2s; }
    .product-back-link:hover, .product-back-link:focus-visible { color: var(--color-primary); transform: translateX(-2px); }
    .product-layout { display: grid; grid-template-columns: minmax(0, 7fr) minmax(360px, 5fr); gap: var(--space-gutter); margin-bottom: 56px; }
    .product-details-col { display: flex; flex-direction: column; padding-top: 8px; }
    .product-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 10px; }
    .product-category-badge { padding: 4px 8px; border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-high); color: var(--color-on-surface-variant); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .product-mpn, .product-model { color: var(--color-outline); font-size: 10px; letter-spacing: 0.05em; }
    .product-title { max-width: 720px; margin: 0 0 22px; font-size: clamp(34px, 3.4vw, 48px); font-weight: 700; line-height: 1.04; letter-spacing: -0.025em; overflow-wrap: anywhere; }
    .price-panel { padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid rgba(68, 73, 51, 0.55); }
    .current-price { display: inline-flex; align-items: baseline; gap: 8px; }
    .price-amount { color: var(--color-primary); font-size: 36px; font-weight: 600; line-height: 1; }
    .price-currency { color: var(--color-on-surface-variant); font-size: 10px; letter-spacing: 0.08em; }
    .price-unavailable, .no-offer-note { color: var(--color-on-surface-variant); font-size: 13px; }
    .product-status-stack { display: grid; gap: 12px; margin-bottom: 24px; }
    .status-panel { min-height: 72px; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 16px; background: var(--color-surface-container-low); border: 1px solid rgba(68, 73, 51, 0.7); }
    .status-indicator { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; }
    .status-indicator::before { border-radius: 0; box-shadow: 0 0 8px rgba(209, 255, 0, 0.35); }
    .status-detail { display: flex; flex-direction: column; align-items: flex-end; color: var(--color-on-surface-variant); font-size: 11px; line-height: 1.25; }
    .status-detail strong { color: var(--color-on-surface); font-size: 10px; text-transform: uppercase; }
    .status-label, .eligibility-value { display: flex; align-items: center; gap: 8px; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
    .status-label { color: var(--color-on-surface-variant); }
    .status-label .material-symbols-outlined { font-size: 18px; }
    .eligibility-value { color: var(--color-primary); text-align: right; }
    .status-blocked .eligibility-value { color: #f59e0b; }
    .product-actions { display: grid; gap: 12px; }
    .primary-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .action-button, .source-link { min-height: 52px; display: flex; align-items: center; justify-content: center; gap: 9px; border-radius: 0; font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; cursor: pointer; transition: background-color 0.2s, border-color 0.2s, color 0.2s; }
    .action-button:disabled { cursor: not-allowed; opacity: 0.45; }
    .action-button-primary { border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-on-primary); }
    .action-button-primary:hover:not(:disabled) { background: var(--color-primary-container); }
    .action-button-compare { border: 1px solid var(--color-primary); background: var(--color-surface-container-high); color: var(--color-primary); }
    .action-button-compare:hover:not(:disabled) { background: var(--color-surface-bright); }
    .action-button .material-symbols-outlined { font-size: 18px; }
    .source-link { border: 1px solid var(--color-outline); color: var(--color-on-surface); text-decoration: none; }
    .source-link:hover, .source-link:focus-visible { border-color: var(--color-primary); color: var(--color-primary); }
    .source-link .material-symbols-outlined { font-size: 15px; }
    .action-unavailable-note { padding: 10px 12px; border-left: 2px solid #f59e0b; background: rgba(245, 158, 11, 0.06); color: var(--color-on-surface-variant); font-size: 10px; line-height: 1.5; }
    .action-error { color: var(--color-error); font-size: 12px; }
    .product-note { max-width: 520px; margin-top: 18px; color: var(--color-on-surface-variant); font-size: 10px; line-height: 1.55; opacity: 0.65; }
    @media (max-width: 1023px) {
      .product-layout { grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr); }
      .product-title { font-size: clamp(30px, 4vw, 42px); }
    }
    @media (max-width: 767px) {
      :host { margin-top: 0; }
      .product-page { padding-bottom: 36px; }
      .product-layout { grid-template-columns: 1fr; gap: 28px; margin-bottom: 40px; }
      .product-title { margin-bottom: 18px; font-size: 34px; }
      .price-amount { font-size: 32px; }
      .status-panel { min-height: 64px; padding: 12px; }
      .primary-actions { grid-template-columns: 1fr; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPage {
  readonly store = inject(ProductDetailStore);
  readonly vm = this.store.viewModel;
  private readonly router = inject(Router);
  private readonly buildService = inject(BuildService);
  private readonly destroyRef = inject(DestroyRef);

  readonly compareSelectorOpen = signal(false);
  readonly addingToBuilder = signal(false);
  readonly addToBuilderError = signal<string | null>(null);

  canAddToBuilder(): boolean {
    return this.getBuilderSlot() !== null;
  }

  isBundle(): boolean {
    return this.vm()?.category.trim().toLocaleLowerCase() === 'bundles';
  }

  addToBuilder(): void {
    const product = this.vm();
    const slot = this.getBuilderSlot();
    if (!product || !slot || this.addingToBuilder()) return;

    this.addingToBuilder.set(true);
    this.addToBuilderError.set(null);

    this.getOrCreateBuild()
      .pipe(
        take(1),
        tap((build) => setLatestBuildId(build.publicId)),
        switchMap((build) =>
          this.buildService.putItem(build.publicId, slot, {
            productId: product.id,
            quantity: 1,
            expectedVersion: build.version,
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.addingToBuilder.set(false)),
      )
      .subscribe({
        next: (build) => {
          setLatestBuildId(build.publicId);
          void this.router.navigate(['/builder', build.publicId]);
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.addToBuilderError.set(this.getAddToBuilderError(error));
        },
      });
  }

  /** Compare is enabled when the product has a valid ID and non-empty category. */
  canCompare(): boolean {
    const v = this.vm();
    return !!v && !!v.id && !!v.category;
  }

  openCompareSelector(): void {
    if (this.canCompare()) {
      this.compareSelectorOpen.set(true);
    }
  }

  onCompareProductSelected(event: { side: 'left' | 'right'; product: { id: string } }): void {
    const v = this.vm();
    if (v) {
      this.compareSelectorOpen.set(false);
      this.router.navigate(['/compare'], {
        queryParams: { left: v.id, right: event.product.id },
      });
    }
  }

  get availabilityLabel(): string {
    const offer = this.vm()?.currentOffer;
    if (!offer) return 'Availability unknown';
    switch (offer.availability) {
      case 'IN_STOCK':
        return 'In stock';
      case 'OUT_OF_STOCK':
        return 'Out of stock';
      case 'PREORDER':
        return 'Pre-order';
      default:
        return offer.availability || 'Availability unknown';
    }
  }

  private getBuilderSlot(): BuildSlotName | null {
    const category = this.vm()?.category.trim().toLocaleLowerCase();
    return category ? CATEGORY_SLOT_MAP[category] ?? null : null;
  }

  private getOrCreateBuild(): Observable<BuildDto> {
    const savedBuildId = getLatestBuildId();
    if (!savedBuildId) return this.buildService.createBuild();

    return this.buildService.getBuild(savedBuildId).pipe(
      catchError((error: { status?: number }) =>
        error.status === 404
          ? this.buildService.createBuild()
          : throwError(() => error),
      ),
    );
  }

  private getAddToBuilderError(error: {
    error?: { error?: string; message?: string };
    message?: string;
  }): string {
    return (
      error.error?.error ??
      error.error?.message ??
      error.message ??
      'Failed to add this product to the Builder.'
    );
  }
}
