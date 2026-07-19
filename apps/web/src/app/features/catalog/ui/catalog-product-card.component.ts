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
    <article class="product-card">
      <!-- Top Bar -->
      <div class="card-status" [ngClass]="statusClass()">
        <span class="status-label">
          {{ statusLabel() }}
        </span>
        <span class="material-symbols-outlined bookmark-icon" aria-hidden="true">bookmark_add</span>
      </div>

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
          <div
            class="product-image-fallback"
            role="img"
            [attr.aria-label]="product.title + ' (no image)'"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
        }
      </div>

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
          <div class="product-identifiers">
            @if (product.model) {
              <div class="identifier">
                <span class="identifier-label">Model</span>
                <strong>{{ product.model }}</strong>
              </div>
            }
            @if (product.mpn) {
              <div class="identifier">
                <span class="identifier-label">MPN</span>
                <strong>{{ product.mpn }}</strong>
              </div>
            }
          </div>
        }

        <div class="product-footer">
          <div class="product-price">
            @if (product.price !== null && product.price !== undefined) {
              <span class="price-amount" [attr.aria-label]="product.price + ' ' + product.currency">
                {{ product.price | number: '1.0-0' }}
                <span class="price-currency">{{ product.currency }}</span>
              </span>
            } @else {
              <span class="price-unknown tech-font" aria-label="Price unavailable"
                >Price unavailable</span
              >
            }
          </div>
        </div>

        <!-- Hover Action (Slide up) -->
        <div class="hover-actions">
          <a [routerLink]="['/products', product.id]" class="hover-btn-primary">Add to Build</a>
          @if (product.sourceUrl) {
            <a
              [href]="product.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="hover-btn-external"
              aria-label="View on store"
            >
              <svg
                class="external-icon"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          }
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        height: 100%;
      }
      .product-card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition:
          transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
          background-color 0.28s ease,
          border-color 0.28s ease,
          box-shadow 0.28s ease;
        height: 100%;
        padding: 0;
        background: #262626;
        border: 1px solid #333333;
        position: relative;
        min-width: 0;
      }
      .product-card:hover {
        box-shadow: inset 0 0 0 1px var(--color-primary);
        background-color: #1f201e;
        border-color: #333333;
        transform: translateY(-2px);
      }
      .card-status {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 48px;
        padding: 12px 16px;
        border-bottom: 1px solid #333333;
        background: #1f1f1f;
        color: #a4aa96;
        font-family: var(--font-mono);
        font-size: 13px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .card-status > span.status-label {
        display: inline-flex;
        align-items: center;
      }
      .bookmark-icon {
        cursor: pointer;
        color: var(--color-on-surface-variant);
        transition: color 0.2s;
        font-size: 20px;
      }
      .bookmark-icon:hover {
        color: var(--color-primary);
      }
      .card-status.in-stock {
        color: var(--color-primary);
      }
      .card-status.out-of-stock {
        color: var(--color-error);
      }
      .card-status.status-caution {
        color: #ffb4ab;
      }
      .record-mark {
        display: none;
      }
      .product-image-wrapper {
        position: relative;
        width: 100%;
        height: 224px;
        background: #121412;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .product-image {
        width: 100%;
        height: 100%;
        max-width: 86%;
        object-fit: contain;
        transition: transform 0.5s;
        position: relative;
        z-index: 1;
      }
      .product-card:hover .product-image {
        transform: scale(1.03);
      }
      .product-image-fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-on-surface-variant);
        opacity: 0.25;
      }
      .product-image-fallback svg {
        width: 36px;
        height: 36px;
      }
      .product-info {
        display: flex;
        flex-direction: column;
        min-height: 336px;
        padding: 24px;
        flex: 1;
        border-top: 1px solid #333333;
        gap: 0;
      }
      .product-meta {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
      }
      .product-category {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-primary);
      }
      .product-brand {
        font-size: 10px;
        color: var(--color-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .product-title {
        font-family: var(--font-sans);
        font-size: 26px;
        font-weight: 600;
        line-height: 32px;
        text-transform: uppercase;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        /* autoprefixer: ignore next */
        -webkit-box-orient: vertical;
        margin: 0 0 20px 0;
      }
      .product-title-link {
        color: var(--color-on-surface);
        text-decoration: none;
        transition: color 0.2s;
        overflow-wrap: anywhere;
      }
      .product-title-link:hover,
      .product-title-link:focus-visible {
        color: var(--color-primary);
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .product-identifiers {
        display: flex;
        flex-direction: column;
        border: 1px solid #333333;
        margin-top: auto;
      }
      .identifier {
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 44px;
        padding: 10px 16px;
        background: #1f1f1f;
      }
      .identifier + .identifier {
        border-top: 1px solid #333333;
        background: #1a1a1a;
      }
      .identifier-label {
        font-family: var(--font-mono);
        color: var(--color-on-surface-variant);
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .identifier strong {
        font-family: var(--font-mono);
        color: var(--color-on-surface);
        font-size: 13px;
        font-weight: 400;
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }
      .product-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 32px;
        gap: 8px;
      }
      .price-amount {
        font-family: var(--font-sans);
        font-size: 28px;
        font-weight: 700;
        color: var(--color-on-surface);
        text-transform: uppercase;
      }
      .price-currency {
        font-size: 16px;
        font-weight: 400;
        color: var(--color-on-surface-variant);
        margin-left: 4px;
      }
      .price-unknown {
        font-family: var(--font-sans);
        font-size: 22px;
        font-weight: 700;
        color: var(--color-on-surface-variant);
        text-transform: uppercase;
      }
      .source-link {
        display: none;
      }
      .hover-actions {
        position: absolute;
        top: 48px;
        bottom: auto;
        left: 0;
        width: 100%;
        padding: 16px;
        background: #1f1f1f;
        border-top: 1px solid var(--color-primary);
        opacity: 0;
        pointer-events: none;
        transform: translateY(-100%);
        transition:
          transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
          opacity 0.2s ease;
        display: flex;
        gap: 8px;
        z-index: 10;
      }
      .product-card:hover .hover-actions,
      .product-card:focus-within .hover-actions {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      .hover-btn-primary {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 12px;
        background: var(--color-primary);
        color: var(--color-on-primary);
        text-decoration: none;
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        transition: background 0.2s;
        flex: 1;
      }
      .hover-btn-primary:hover,
      .hover-btn-primary:focus-visible {
        background: var(--color-primary-container);
        outline: none;
      }
      .hover-btn-external {
        width: 48px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--color-outline-variant);
        color: var(--color-on-surface-variant);
        transition:
          border-color 0.2s ease,
          color 0.2s ease,
          background-color 0.2s ease;
      }
      .hover-btn-external:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .external-icon {
        width: 16px;
        height: 16px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogProductCardComponent {
  product!: CatalogProductListItem;
  imageError = false;

  get imageUrl(): string | null {
    return this.product.images?.length ? this.product.images[0]! : null;
  }

  get availabilityLabel(): string {
    switch (this.product.availability) {
      case 'IN_STOCK':
        return 'In stock';
      case 'OUT_OF_STOCK':
        return 'Out of stock';
      case 'PREORDER':
        return 'Pre-order';
      default:
        return 'Availability unknown';
    }
  }

  statusLabel(): string {
    return this.availabilityLabel;
  }

  statusClass(): string {
    switch (this.product.availability) {
      case 'IN_STOCK':
        return 'in-stock';
      case 'OUT_OF_STOCK':
        return 'out-of-stock out-of-stock-badge';
      default:
        return 'status-caution';
    }
  }
}
