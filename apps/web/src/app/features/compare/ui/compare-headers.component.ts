import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ProductDetailViewModel } from '../../product/data-access/product-detail.store';

const BUILDER_CATEGORIES = new Set(['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case']);

@Component({
  selector: 'bs-compare-headers',
  standalone: true,
  imports: [CommonModule],
  inputs: ['leftVm', 'rightVm', 'loading', 'addingSide'],
  template: `
    <div class="compare-headers">
      <!-- Left slot -->
      <div class="compare-header card" [class.header-loading]="!leftVm && loading">
        @if (leftVm) {
          <span class="header-slot tech-font">Slot_A</span>
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
            <span class="header-category-badge">{{ leftVm!.brand || leftVm!.category }}</span>
            @if (leftVm!.mpn) {
              <span class="header-mpn">MPN: {{ leftVm!.mpn }}</span>
            }
          </div>
          <h3 class="header-title" [title]="leftVm!.title">{{ leftVm!.title }}</h3>
          @if (leftVm!.currentOffer) {
            <div class="header-offer">
              <span class="header-price-label tech-font">Current observed price</span>
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
            </div>
          } @else {
            <div class="header-no-offer tech-font">No pricing information available.</div>
          }
          <div class="header-actions">
            <button
              class="header-action header-add-btn tech-font"
              type="button"
              [disabled]="!canAddToBuilder(leftVm!) || addingSide !== null"
              (click)="onAddToBuild.emit('left')"
              aria-label="Add product A to build">
              <span class="material-symbols-outlined" aria-hidden="true">add</span>
              {{ addingSide === 'left' ? 'Adding...' : 'Add to Build' }}
            </button>
            <div class="header-secondary-actions">
              @if (leftVm!.currentOffer?.sourceUrl) {
                <a
                  class="header-action header-source-link tech-font"
                  [href]="leftVm!.currentOffer!.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  [attr.aria-label]="'Open ' + leftVm!.title + ' at Sigma store (opens in new tab)'">
                  <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>
                  Open at Sigma
                </a>
              }
              <button
                class="header-action header-change-btn tech-font"
                type="button"
                (click)="onChangeClick.emit('left')"
                aria-label="Change product A">
                <span class="material-symbols-outlined" aria-hidden="true">swap_horiz</span>
                Change Selection
              </button>
            </div>
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
          <span class="header-slot tech-font">Slot_B</span>
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
            <span class="header-category-badge">{{ rightVm!.brand || rightVm!.category }}</span>
            @if (rightVm!.mpn) {
              <span class="header-mpn">MPN: {{ rightVm!.mpn }}</span>
            }
          </div>
          <h3 class="header-title" [title]="rightVm!.title">{{ rightVm!.title }}</h3>
          @if (rightVm!.currentOffer) {
            <div class="header-offer">
              <span class="header-price-label tech-font">Current observed price</span>
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
            </div>
          } @else {
            <div class="header-no-offer tech-font">No pricing information available.</div>
          }
          <div class="header-actions">
            <button
              class="header-action header-add-btn tech-font"
              type="button"
              [disabled]="!canAddToBuilder(rightVm!) || addingSide !== null"
              (click)="onAddToBuild.emit('right')"
              aria-label="Add product B to build">
              <span class="material-symbols-outlined" aria-hidden="true">add</span>
              {{ addingSide === 'right' ? 'Adding...' : 'Add to Build' }}
            </button>
            <div class="header-secondary-actions">
              @if (rightVm!.currentOffer?.sourceUrl) {
                <a
                  class="header-action header-source-link tech-font"
                  [href]="rightVm!.currentOffer!.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  [attr.aria-label]="'Open ' + rightVm!.title + ' at Sigma store (opens in new tab)'">
                  <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>
                  Open at Sigma
                </a>
              }
              <button
                class="header-action header-change-btn tech-font"
                type="button"
                (click)="onChangeClick.emit('right')"
                aria-label="Change product B">
                <span class="material-symbols-outlined" aria-hidden="true">swap_horiz</span>
                Change Selection
              </button>
            </div>
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
      margin-bottom: 24px;
    }
    .compare-header {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      padding: 24px;
      border: 1px solid rgba(68, 73, 51, 0.65);
      background: var(--color-surface-container);
    }
    .header-loading {
      min-height: 300px;
    }
    .header-image {
      width: 100%;
      height: clamp(180px, 14vw, 220px);
      padding: 32px;
      background: var(--color-surface-container-lowest);
      border: 1px solid rgba(68, 73, 51, 0.5);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 2px 15px rgba(0, 0, 0, 0.5);
    }
    .header-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.7));
    }
    .header-img-fallback {
      color: var(--color-on-surface-variant);
      opacity: 0.4;
    }
    .header-img-fallback svg {
      width: 40px;
      height: 40px;
    }
    .header-slot {
      position: absolute;
      top: 0;
      right: 0;
      z-index: 1;
      padding: 5px 10px;
      border-bottom: 1px solid rgba(68, 73, 51, 0.6);
      border-left: 1px solid rgba(68, 73, 51, 0.6);
      background: var(--color-surface-container-high);
      color: var(--color-on-surface-variant);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .header-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .header-category-badge {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-primary);
      font-weight: 700;
    }
    .header-mpn {
      font-size: 12px;
      color: var(--color-on-surface-variant);
      background: var(--color-surface-container);
      padding: 2px 8px;
    }
    .header-title {
      display: -webkit-box;
      min-height: 52px;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      font-size: 22px;
      font-weight: 600;
      line-height: 1.18;
      margin: 0;
    }
    .header-offer {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
      gap: 2px 16px;
      padding-top: 14px;
      border-top: 1px solid rgba(68, 73, 51, 0.38);
    }
    .header-price-label {
      grid-column: 1 / -1;
      color: var(--color-on-surface-variant);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
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
      color: var(--color-primary);
    }
    .header-price-currency {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    .header-price-unknown {
      font-size: 24px;
      color: var(--color-on-surface-variant);
    }
    .header-no-offer {
      min-height: 61px;
      padding-top: 14px;
      border-top: 1px solid rgba(68, 73, 51, 0.38);
      font-size: 13px;
      color: var(--color-on-surface-variant);
      font-style: italic;
    }
    .header-actions {
      display: grid;
      gap: 10px;
      margin-top: auto;
    }
    .header-secondary-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .header-action {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 12px;
      border: 1px solid var(--color-outline-variant);
      border-radius: 0;
      background: transparent;
      color: var(--color-on-surface-variant);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-decoration: none;
      text-transform: uppercase;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s, background-color 0.2s;
    }
    .header-action .material-symbols-outlined { font-size: 17px; }
    .header-action:hover,
    .header-action:focus-visible {
      border-color: var(--color-primary);
      color: var(--color-primary);
      outline: none;
    }
    .header-add-btn {
      min-height: 48px;
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-size: 12px;
    }
    .header-add-btn:hover:not(:disabled),
    .header-add-btn:focus-visible:not(:disabled) {
      background: var(--color-primary-container);
      color: var(--color-on-primary);
    }
    .header-add-btn:disabled {
      cursor: not-allowed;
      opacity: 0.42;
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
    @media (max-width: 767px) {
      .compare-headers {
        grid-template-columns: 1fr;
      }
      .header-title {
        min-height: auto;
        font-size: 20px;
      }
      .header-price-amount {
        font-size: 20px;
      }
      .header-image { height: 200px; padding: 24px; }
      .header-secondary-actions { grid-template-columns: 1fr; }
    }
  `],
})
export class CompareHeadersComponent {
  leftVm: ProductDetailViewModel | null = null;
  rightVm: ProductDetailViewModel | null = null;
  loading = false;
  addingSide: 'left' | 'right' | null = null;
  onAddToBuild = output<'left' | 'right'>();
  onChangeClick = output<'left' | 'right'>();

  leftImgError = signal(false);
  rightImgError = signal(false);

  canAddToBuilder(product: ProductDetailViewModel): boolean {
    return BUILDER_CATEGORIES.has(product.category.trim().toLocaleLowerCase());
  }

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
