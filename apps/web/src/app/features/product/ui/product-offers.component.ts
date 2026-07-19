import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ProductOfferViewModel } from '../data-access/product-detail.store';

/**
 * Human-readable labels for store codes.
 * Used for display only — keep in sync with the backend StoreCode type.
 */
const STORE_LABELS: Record<string, string> = {
  SIGMA: 'Sigma Computer',
  EL_NOUR: 'El Nour Tech',
};

@Component({
  selector: 'app-product-offers',
  standalone: true,
  imports: [CommonModule],
  inputs: ['offers'],
  template: `
    @if (offers && offers.length > 0) {
      <section class="offers-section" aria-label="Available offers">
        <h2 class="offers-heading">Offers</h2>
        <div class="offers-list" role="list">
          @for (offer of offers; track offer.id) {
            <div class="offer-row" role="listitem">
              <div class="offer-store tech-font">{{ storeLabel(offer.storeCode) }}</div>
              <div class="offer-price">
                @if (offer.price !== null && offer.price >= 0) {
                  <span class="price-amount" [attr.aria-label]="offer.price + ' ' + offer.currency">
                    {{ offer.price | number:'1.0-0' }}
                    <span class="price-currency">{{ offer.currency }}</span>
                  </span>
                } @else {
                  <span class="price-unknown tech-font" aria-label="Price unavailable">\u2014</span>
                }
              </div>
              <div class="offer-availability">
                <span
                  class="status-indicator tech-font"
                  [class.status-success]="offer.availability === 'IN_STOCK'"
                  [class.status-warning]="offer.availability !== 'IN_STOCK' && offer.availability !== 'OUT_OF_STOCK'"
                  [attr.aria-label]="availabilityLabel(offer)">
                  {{ availabilityLabel(offer) }}
                </span>
              </div>
              @if (offer.sourceUrl) {
                <a
                  class="offer-link tech-font"
                  [href]="offer.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  [attr.aria-label]="'View on ' + storeLabel(offer.storeCode) + ' (opens in new tab)'">
                  View
                  <svg class="external-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              }
            </div>
          }
        </div>
      </section>
    }
  `,
  styles: [`
    .offers-section {
      margin: 0 0 40px;
      padding: 18px;
      border: 1px solid rgba(68, 73, 51, 0.55);
      background: var(--color-surface-container-low);
    }
    .offers-heading {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 10px;
      color: var(--color-on-surface);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .offers-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .offer-row {
      display: grid;
      grid-template-columns: minmax(100px, auto) minmax(100px, auto) 1fr auto;
      gap: 16px;
      align-items: center;
      padding: 10px 0;
      border-bottom: var(--border-width) solid var(--color-border);
    }
    .offer-row:last-child {
      border-bottom: none;
    }
    .offer-store {
      font-size: 12px;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .price-amount {
      font-family: var(--font-mono);
      font-size: 16px;
      font-weight: 700;
      color: var(--color-on-surface);
    }
    .price-currency {
      font-size: 11px;
      color: var(--color-on-surface-variant);
      margin-left: 2px;
    }
    .price-unknown {
      font-size: 18px;
      color: var(--color-on-surface-variant);
    }
    .offer-availability {
      font-size: 12px;
    }
    .offer-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--color-on-surface-variant);
      text-decoration: none;
      transition: color 0.2s;
    }
    .offer-link:hover, .offer-link:focus-visible {
      color: var(--color-primary);
    }
    .external-icon {
      width: 12px;
      height: 12px;
    }
    @media (max-width: 767px) {
      .offer-row {
        grid-template-columns: 1fr auto;
        gap: 8px;
      }
      .offer-availability {
        grid-column: 1 / -1;
      }
    }
  `],
})
export class ProductOffersComponent {
  offers: ProductOfferViewModel[] = [];

  storeLabel(code: string): string {
    return STORE_LABELS[code] ?? code;
  }

  availabilityLabel(offer: ProductOfferViewModel): string {
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
