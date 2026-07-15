import { Component } from '@angular/core';
import type { PurchasePlanComponentRowViewModel } from '../purchase-plan-view.models';

/**
 * Presentational component row for a single item in the Purchase Review.
 *
 * Input-driven: receives an immutable PurchasePlanComponentRowViewModel.
 * Displays slot name, product name, price, and availability exactly as
 * supplied by the wrapper — no computation, no active behavior.
 */
@Component({
  selector: 'app-purchase-plan-row',
  standalone: true,
  inputs: ['row'],
  template: `
    <div class="review-row" role="row">
      <div class="row-slot" role="cell">
        <span class="slot-name">{{ row.slotDisplayName }}</span>
      </div>
      <div class="row-product" role="cell">
        <span class="product-name">{{ row.productName }}</span>
      </div>
      <div class="row-price" role="cell">
        <span class="price-value tech-font">{{ row.priceLabel }}</span>
      </div>
      <div class="row-availability" role="cell">
        <span class="availability-value">{{ row.availabilityLabel }}</span>
      </div>
    </div>
  `,
  styles: `
    .review-row {
      display: grid;
      grid-template-columns: 100px 1fr 120px 100px;
      gap: var(--space-base);
      padding: var(--space-base) var(--space-gutter);
      border-bottom: var(--border-width) solid var(--color-border);
      align-items: center;
      min-height: 48px;
    }
    .slot-name {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
    }
    .product-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .price-value {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-primary);
    }
    .availability-value {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
    }
    @media (max-width: 768px) {
      .review-row {
        grid-template-columns: 80px 1fr;
        grid-template-rows: auto auto;
      }
      .row-price {
        grid-column: 2;
        grid-row: 2;
        text-align: right;
      }
      .row-availability {
        display: none;
      }
    }
  `,
})
export class PurchasePlanRowComponent {
  row!: PurchasePlanComponentRowViewModel;
}
