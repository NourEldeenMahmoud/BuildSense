import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CatalogProductListItem } from '../../../shared/contracts/catalog';

/**
 * Bundle badge: The CatalogProductListItem response has no `isBundle` field.
 * The badge is omitted per Stage 4 requirements: do not infer bundle status from title.
 * Limitation documented. Will be re-evaluated if the backend adds a dedicated field.
 */
@Component({
  selector: 'app-catalog-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  inputs: ['product'],
  template: `
    <article class="product-card card" [attr.aria-label]="product.title">
      <!-- Product Image -->
      <div class="product-image-wrapper">
        @if (imageUrl && !imageError) {
          <img
            class="product-image"
            [src]="imageUrl"
            [alt]="product.title"
            loading="lazy"
            (error)="imageError = true"
          />
        } @else {
          <div class="product-image-fallback" role="img" [attr.aria-label]="product.title + ' (no image)'">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
        }
        <!-- Availability badge -->
        @if (product.availability === 'OUT_OF_STOCK') {
          <div class="out-of-stock-badge tech-font" aria-label="Out of stock">Out of stock</div>
        }
      </div>

      <!-- Product Info -->
      <div class="product-info">
        <div class="product-meta tech-font">
          <span class="product-category">{{ product.category }}</span>
          @if (product.brand) {
            <span class="product-brand">{{ product.brand }}</span>
          }
        </div>

        <h3 class="product-title">
          <a [routerLink]="['/products', product.id]" class="product-title-link">
            {{ product.title }}
          </a>
        </h3>

        @if (product.model || product.mpn) {
          <div class="product-identifiers tech-font">
            @if (product.model) {
              <span class="identifier">{{ product.model }}</span>
            }
            @if (product.mpn) {
              <span class="identifier mpn">MPN: {{ product.mpn }}</span>
            }
          </div>
        }

        <div class="product-footer">
          <!-- Price -->
          <div class="product-price">
            @if (product.price !== null && product.price !== undefined) {
              <span class="price-amount" [attr.aria-label]="product.price + ' ' + product.currency">
                {{ product.price | number:'1.0-0' }}
                <span class="price-currency">{{ product.currency }}</span>
              </span>
            } @else {
              <span class="price-unknown tech-font" aria-label="Price unavailable">—</span>
            }
          </div>

          <!-- Availability status (not Out of Stock since that's shown on image) -->
          @if (product.availability !== 'OUT_OF_STOCK') {
            <span class="availability-badge status-indicator"
              [class.status-success]="product.availability === 'IN_STOCK'"
              [class.status-warning]="product.availability === 'UNKNOWN' || product.availability === 'PREORDER'"
              [attr.aria-label]="availabilityLabel">
              {{ availabilityLabel }}
            </span>
          }
        </div>

        <!-- Source link to Sigma store -->
        @if (product.sourceUrl) {
          <a
            class="source-link tech-font"
            [href]="product.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            [attr.aria-label]="'View ' + product.title + ' on Sigma store (opens in new tab)'">
            View on Sigma
            <svg class="external-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        }
      </div>
    </article>
  `,
  styles: [`
    .product-card {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: border-color 0.2s, transform 0.2s;
      height: 100%;
    }
    .product-card:hover {
      border-color: var(--color-outline);
      transform: translateY(-2px);
    }
    .product-image-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      background: var(--color-surface-container);
      overflow: hidden;
    }
    .product-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .product-image-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-on-surface-variant);
      opacity: 0.3;
    }
    .product-image-fallback svg {
      width: 40px;
      height: 40px;
    }
    .out-of-stock-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(18,20,18,0.85);
      border: 1px solid var(--color-error);
      color: var(--color-error);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 8px;
    }
    .product-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      flex: 1;
    }
    .product-meta {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .product-category {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-primary);
    }
    .product-brand {
      font-size: 10px;
      color: var(--color-on-surface-variant);
    }
    .product-title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      margin: 0;
    }
    .product-title-link {
      color: var(--color-on-surface);
      text-decoration: none;
      transition: color 0.2s;
    }
    .product-title-link:hover,
    .product-title-link:focus-visible {
      color: var(--color-primary);
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    .product-identifiers {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .identifier {
      font-size: 10px;
      color: var(--color-on-surface-variant);
      background: var(--color-surface-container);
      padding: 2px 6px;
    }
    .product-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: auto;
      flex-wrap: wrap;
      gap: 8px;
    }
    .price-amount {
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
      color: var(--color-on-surface);
    }
    .price-currency {
      font-size: 11px;
      color: var(--color-on-surface-variant);
      margin-left: 2px;
    }
    .price-unknown {
      font-size: 20px;
      color: var(--color-on-surface-variant);
    }
    .availability-badge {
      font-size: 10px;
    }
    .source-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--color-on-surface-variant);
      text-decoration: none;
      margin-top: 4px;
      transition: color 0.2s;
    }
    .source-link:hover, .source-link:focus-visible {
      color: var(--color-primary);
    }
    .external-icon {
      width: 10px;
      height: 10px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogProductCardComponent {
  product!: CatalogProductListItem;
  imageError = false;

  get imageUrl(): string | null {
    return this.product.images?.length ? this.product.images[0]! : null;
  }

  get availabilityLabel(): string {
    switch (this.product.availability) {
      case 'IN_STOCK': return 'In stock';
      case 'OUT_OF_STOCK': return 'Out of stock';
      case 'PREORDER': return 'Pre-order';
      default: return 'Availability unknown';
    }
  }
}
