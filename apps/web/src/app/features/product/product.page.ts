import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductDetailStore } from './data-access/product-detail.store';
import { ProductGalleryComponent } from './ui/product-gallery.component';
import { ProductSpecsComponent } from './ui/product-specs.component';
import { ProductOffersComponent } from './ui/product-offers.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { ButtonComponent } from '../../shared/components/button.component';

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
    ErrorStateComponent,
    ButtonComponent,
  ],
  template: `
    <div class="product-page app-container">
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
        <!-- Breadcrumb -->
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol class="breadcrumb-list tech-font">
            <li class="breadcrumb-item">
              <a routerLink="/" class="breadcrumb-link">Home</a>
            </li>
            <li class="breadcrumb-separator" aria-hidden="true">›</li>
            <li class="breadcrumb-item">
              <a routerLink="/" [queryParams]="{ category: vm()!.category }" class="breadcrumb-link">
                {{ vm()!.category }}
              </a>
            </li>
            <li class="breadcrumb-separator" aria-hidden="true">›</li>
            <li class="breadcrumb-item breadcrumb-current" aria-current="page">
              {{ vm()!.title }}
            </li>
          </ol>
        </nav>

        <!-- Product layout -->
        <div class="product-layout">
          <!-- Gallery column -->
          <div class="product-gallery-col">
            <app-product-gallery
              [images]="vm()!.images"
              [altText]="vm()!.title">
            </app-product-gallery>
          </div>

          <!-- Details column -->
          <div class="product-details-col">
            <!-- Category & identifiers -->
            <div class="product-meta tech-font">
              <span class="product-category-badge">{{ vm()!.category }}</span>
              @if (vm()!.mpn) {
                <span class="product-mpn">MPN: {{ vm()!.mpn }}</span>
              }
              @if (vm()!.model) {
                <span class="product-model">{{ vm()!.model }}</span>
              }
            </div>

            <!-- Title -->
            <h1 class="product-title">{{ vm()!.title }}</h1>

            <!-- Current offer panel -->
            <div class="current-offer-panel card">
              @if (vm()!.currentOffer) {
                <!-- Price -->
                <div class="offer-price-row">
                  @if (vm()!.currentOffer!.price !== null && vm()!.currentOffer!.price! >= 0) {
                    <div class="current-price" [attr.aria-label]="vm()!.currentOffer!.price + ' ' + vm()!.currentOffer!.currency">
                      <span class="price-amount">{{ vm()!.currentOffer!.price! | number:'1.0-0' }}</span>
                      <span class="price-currency">{{ vm()!.currentOffer!.currency }}</span>
                    </div>
                  } @else {
                    <div class="current-price price-unknown-row">
                      <span class="price-unknown tech-font" aria-label="Price unavailable">\u2014</span>
                    </div>
                  }
                </div>

                <!-- Availability -->
                <div class="offer-availability">
                  <span
                    class="status-indicator tech-font"
                    [class.status-success]="vm()!.currentOffer!.availability === 'IN_STOCK'"
                    [class.status-warning]="vm()!.currentOffer!.availability !== 'IN_STOCK' && vm()!.currentOffer!.availability !== 'OUT_OF_STOCK'"
                    [attr.aria-label]="availabilityLabel">
                    {{ availabilityLabel }}
                  </span>
                </div>

                <!-- Source link -->
                @if (vm()!.currentOffer!.sourceUrl) {
                  <a
                    class="source-link tech-font"
                    [href]="vm()!.currentOffer!.sourceUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    [attr.aria-label]="'View ' + vm()!.title + ' on Sigma store (opens in new tab)'">
                    View on Sigma
                    <svg class="external-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </a>
                }
              } @else {
                <div class="no-offer-note tech-font">
                  No pricing information available for this product.
                </div>
              }
            </div>

            <!-- Brand -->
            @if (vm()!.brand) {
              <div class="product-brand-line tech-font">
                <span class="brand-label">Brand:</span>
                <span class="brand-value">{{ vm()!.brand }}</span>
              </div>
            }

            <!-- Actions: Builder & Compare (disabled/deferred) -->
            <div class="product-actions">
              <app-button
                variant="primary"
                [disabled]="true"
                ariaLabel="Add to Builder — available in a future milestone">
                Add to Builder
              </app-button>
              <div class="action-unavailable-note tech-font">
                Builder is available in a future milestone.
              </div>

              <app-button
                variant="secondary"
                [disabled]="true"
                ariaLabel="Compare — available soon"
                style="margin-top: 12px;">
                Compare — available soon
              </app-button>
            </div>
          </div>
        </div>

        <!-- All offers section (only when > 1) -->
        @if (vm()!.hasMultipleOffers) {
          <app-product-offers [offers]="vm()!.allOffers"></app-product-offers>
        }

        <!-- Raw specifications -->
        <app-product-specs [specs]="vm()!.rawSpecifications"></app-product-specs>
      }
    </div>
  `,
  styles: [`
    .product-page {
      padding-top: 24px;
      padding-bottom: 48px;
    }

    /* Loading */
    .product-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 400px;
    }
    .loading-text {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 3px solid var(--color-surface-container-high);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Breadcrumb */
    .breadcrumb {
      margin-bottom: 24px;
    }
    .breadcrumb-list {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      list-style: none;
      margin: 0;
      padding: 0;
      font-size: 12px;
    }
    .breadcrumb-link {
      color: var(--color-on-surface-variant);
      text-decoration: none;
      transition: color 0.2s;
    }
    .breadcrumb-link:hover,
    .breadcrumb-link:focus-visible {
      color: var(--color-primary);
    }
    .breadcrumb-separator {
      color: var(--color-on-surface-variant);
      opacity: 0.5;
    }
    .breadcrumb-current {
      color: var(--color-on-surface);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Layout */
    .product-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-gutter);
      margin-bottom: var(--space-gutter);
    }

    /* Details column */
    .product-details-col {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .product-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .product-category-badge {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-primary);
      font-weight: 700;
    }
    .product-mpn,
    .product-model {
      font-size: 11px;
      color: var(--color-on-surface-variant);
      background: var(--color-surface-container);
      padding: 2px 8px;
    }
    .product-title {
      font-size: 24px;
      font-weight: 600;
      line-height: 1.3;
      margin: 0;
    }
    .product-brand-line {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    .brand-label {
      opacity: 0.6;
    }
    .brand-value {
      color: var(--color-on-surface);
    }

    /* Current offer panel */
    .current-offer-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .offer-price-row {
      display: flex;
      align-items: baseline;
    }
    .current-price {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
    }
    .price-amount {
      font-family: var(--font-mono);
      font-size: 28px;
      font-weight: 700;
      color: var(--color-on-surface);
    }
    .price-currency {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    .price-unknown-row {
      display: flex;
    }
    .price-unknown {
      font-size: 28px;
      color: var(--color-on-surface-variant);
    }
    .offer-availability {
      display: flex;
      align-items: center;
    }
    .source-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--color-on-surface-variant);
      text-decoration: none;
      transition: color 0.2s;
      margin-top: 4px;
    }
    .source-link:hover,
    .source-link:focus-visible {
      color: var(--color-primary);
    }
    .external-icon {
      width: 14px;
      height: 14px;
    }
    .no-offer-note {
      font-size: 13px;
      color: var(--color-on-surface-variant);
      font-style: italic;
    }

    /* Actions */
    .product-actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 8px;
    }
    .action-unavailable-note {
      font-size: 11px;
      color: var(--color-on-surface-variant);
      opacity: 0.6;
    }

    /* Responsive */
    @media (max-width: 767px) {
      .product-layout {
        grid-template-columns: 1fr;
      }
      .product-title {
        font-size: 20px;
      }
      .price-amount {
        font-size: 24px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPage {
  readonly store = inject(ProductDetailStore);
  readonly vm = this.store.viewModel;

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
}
