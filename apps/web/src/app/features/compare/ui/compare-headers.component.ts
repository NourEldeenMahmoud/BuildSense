import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ProductDetailViewModel } from '../../product/data-access/product-detail.store';

@Component({
  selector: 'bs-compare-headers',
  standalone: true,
  imports: [CommonModule],
  inputs: ['leftVm', 'rightVm', 'loading'],
  template: `
    <div class="compare-headers">
      <!-- Left slot -->
      <div class="compare-header card" [class.header-loading]="!leftVm && loading">
        @if (leftVm) {
          <div class="header-image">
            @if (leftVm!.primaryImageUrl && !leftImgError()) {
              <img
                class="header-img"
                [src]="leftVm!.primaryImageUrl"
                [alt]="leftVm!.title"
                loading="lazy"
                (error)="leftImgError.set(true)"
              />
            } @else {
              <div class="header-img-fallback" role="img" [attr.aria-label]="leftVm!.title + ' (no image)'">
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </div>
            }
          </div>
          <div class="header-meta tech-font">
            <span class="header-category-badge">{{ leftVm!.category }}</span>
            @if (leftVm!.mpn) {
              <span class="header-mpn">MPN: {{ leftVm!.mpn }}</span>
            }
          </div>
          <h3 class="header-title">{{ leftVm!.title }}</h3>
          @if (leftVm!.currentOffer) {
            <div class="header-offer">
              @if (leftVm!.currentOffer!.price !== null && leftVm!.currentOffer!.price! >= 0) {
                <div class="header-price" [attr.aria-label]="leftVm!.currentOffer!.price + ' ' + leftVm!.currentOffer!.currency">
                  <span class="header-price-amount">{{ leftVm!.currentOffer!.price! | number:'1.0-0' }}</span>
                  <span class="header-price-currency">{{ leftVm!.currentOffer!.currency }}</span>
                </div>
              } @else {
                <div class="header-price">
                  <span class="header-price-unknown tech-font" aria-label="Price unavailable">\u2014</span>
                </div>
              }
              <span
                class="status-indicator tech-font"
                [class.status-success]="leftVm!.currentOffer!.availability === 'IN_STOCK'"
                [class.status-warning]="leftVm!.currentOffer!.availability !== 'IN_STOCK' && leftVm!.currentOffer!.availability !== 'OUT_OF_STOCK'"
                [attr.aria-label]="getAvailabilityLabel(leftVm!.currentOffer!.availability)">
                {{ getAvailabilityLabel(leftVm!.currentOffer!.availability) }}
              </span>
              @if (leftVm!.currentOffer!.sourceUrl) {
                <a
                  class="header-source-link tech-font"
                  [href]="leftVm!.currentOffer!.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  [attr.aria-label]="'View ' + leftVm!.title + ' on Sigma store (opens in new tab)'">
                  View on Sigma
                  <svg class="external-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              }
            </div>
          } @else {
            <div class="header-no-offer tech-font">No pricing information available.</div>
          }
          <div class="header-actions">
            <button
              class="btn btn-secondary header-change-btn"
              (click)="onChangeClick.emit('left')"
              aria-label="Change product A">
              Change
            </button>
          </div>
        } @else if (loading) {
          <div class="header-skeleton" role="status" aria-label="Loading left product">
            <div class="skeleton-block" style="width: 100%; height: 200px;"></div>
            <div class="skeleton-block" style="width: 60%; height: 16px; margin-top: 12px;"></div>
            <div class="skeleton-block" style="width: 80%; height: 24px; margin-top: 8px;"></div>
          </div>
        }
      </div>

      <!-- Right slot -->
      <div class="compare-header card" [class.header-loading]="!rightVm && loading">
        @if (rightVm) {
          <div class="header-image">
            @if (rightVm!.primaryImageUrl && !rightImgError()) {
              <img
                class="header-img"
                [src]="rightVm!.primaryImageUrl"
                [alt]="rightVm!.title"
                loading="lazy"
                (error)="rightImgError.set(true)"
              />
            } @else {
              <div class="header-img-fallback" role="img" [attr.aria-label]="rightVm!.title + ' (no image)'">
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </div>
            }
          </div>
          <div class="header-meta tech-font">
            <span class="header-category-badge">{{ rightVm!.category }}</span>
            @if (rightVm!.mpn) {
              <span class="header-mpn">MPN: {{ rightVm!.mpn }}</span>
            }
          </div>
          <h3 class="header-title">{{ rightVm!.title }}</h3>
          @if (rightVm!.currentOffer) {
            <div class="header-offer">
              @if (rightVm!.currentOffer!.price !== null && rightVm!.currentOffer!.price! >= 0) {
                <div class="header-price" [attr.aria-label]="rightVm!.currentOffer!.price + ' ' + rightVm!.currentOffer!.currency">
                  <span class="header-price-amount">{{ rightVm!.currentOffer!.price! | number:'1.0-0' }}</span>
                  <span class="header-price-currency">{{ rightVm!.currentOffer!.currency }}</span>
                </div>
              } @else {
                <div class="header-price">
                  <span class="header-price-unknown tech-font" aria-label="Price unavailable">\u2014</span>
                </div>
              }
              <span
                class="status-indicator tech-font"
                [class.status-success]="rightVm!.currentOffer!.availability === 'IN_STOCK'"
                [class.status-warning]="rightVm!.currentOffer!.availability !== 'IN_STOCK' && rightVm!.currentOffer!.availability !== 'OUT_OF_STOCK'"
                [attr.aria-label]="getAvailabilityLabel(rightVm!.currentOffer!.availability)">
                {{ getAvailabilityLabel(rightVm!.currentOffer!.availability) }}
              </span>
              @if (rightVm!.currentOffer!.sourceUrl) {
                <a
                  class="header-source-link tech-font"
                  [href]="rightVm!.currentOffer!.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  [attr.aria-label]="'View ' + rightVm!.title + ' on Sigma store (opens in new tab)'">
                  View on Sigma
                  <svg class="external-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              }
            </div>
          } @else {
            <div class="header-no-offer tech-font">No pricing information available.</div>
          }
          <div class="header-actions">
            <button
              class="btn btn-secondary header-change-btn"
              (click)="onChangeClick.emit('right')"
              aria-label="Change product B">
              Change
            </button>
          </div>
        } @else if (loading) {
          <div class="header-skeleton" role="status" aria-label="Loading right product">
            <div class="skeleton-block" style="width: 100%; height: 200px;"></div>
            <div class="skeleton-block" style="width: 60%; height: 16px; margin-top: 12px;"></div>
            <div class="skeleton-block" style="width: 80%; height: 24px; margin-top: 8px;"></div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .compare-headers {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-gutter);
      margin-bottom: var(--space-gutter);
    }
    .compare-header {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .header-loading {
      min-height: 300px;
    }
    .header-image {
      width: 100%;
      aspect-ratio: 1;
      background: var(--color-surface-container);
      border: var(--border-width) solid var(--color-border);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .header-img-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--color-on-surface-variant);
      opacity: 0.4;
    }
    .header-img-fallback svg {
      width: 48px;
      height: 48px;
    }
    .header-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .header-category-badge {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-primary);
      font-weight: 700;
    }
    .header-mpn {
      font-size: 11px;
      color: var(--color-on-surface-variant);
      background: var(--color-surface-container);
      padding: 2px 8px;
    }
    .header-title {
      font-size: 18px;
      font-weight: 600;
      line-height: 1.3;
      margin: 0;
    }
    .header-offer {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .header-price {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
    }
    .header-price-amount {
      font-family: var(--font-mono);
      font-size: 24px;
      font-weight: 700;
      color: var(--color-on-surface);
    }
    .header-price-currency {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    .header-price-unknown {
      font-size: 24px;
      color: var(--color-on-surface-variant);
    }
    .header-source-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--color-on-surface-variant);
      text-decoration: none;
      transition: color 0.2s;
    }
    .header-source-link:hover,
    .header-source-link:focus-visible {
      color: var(--color-primary);
    }
    .external-icon {
      width: 14px;
      height: 14px;
    }
    .header-no-offer {
      font-size: 13px;
      color: var(--color-on-surface-variant);
      font-style: italic;
    }
    .header-actions {
      margin-top: 4px;
    }
    .header-change-btn {
      font-size: 12px;
      padding: 8px 16px;
    }
    .header-skeleton {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .skeleton-block {
      background-color: var(--color-surface-container-high);
      animation: skeleton-pulse 1.5s infinite ease-in-out;
    }
    @keyframes skeleton-pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-primary);
      font-weight: 600;
      border-radius: var(--radius-none);
      border: var(--border-width) solid transparent;
      padding: 12px 24px;
      cursor: pointer;
      transition: all 0.2s ease-in-out;
      text-transform: uppercase;
      font-size: 14px;
      letter-spacing: 0.05em;
    }
    .btn-secondary {
      background-color: transparent;
      border-color: var(--color-on-surface);
      color: var(--color-on-surface);
      font-family: var(--font-mono);
    }
    .btn-secondary:hover {
      background-color: var(--color-surface-container-high);
    }

    @media (max-width: 767px) {
      .compare-headers {
        grid-template-columns: 1fr;
      }
      .header-title {
        font-size: 16px;
      }
      .header-price-amount {
        font-size: 20px;
      }
    }
  `],
})
export class CompareHeadersComponent {
  leftVm: ProductDetailViewModel | null = null;
  rightVm: ProductDetailViewModel | null = null;
  loading = false;
  onChangeClick = output<'left' | 'right'>();

  leftImgError = signal(false);
  rightImgError = signal(false);

  getAvailabilityLabel(availability: string): string {
    switch (availability) {
      case 'IN_STOCK':
        return 'In stock';
      case 'OUT_OF_STOCK':
        return 'Out of stock';
      case 'PREORDER':
        return 'Pre-order';
      default:
        return availability || 'Availability unknown';
    }
  }
}
