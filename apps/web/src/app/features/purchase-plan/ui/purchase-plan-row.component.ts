import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PurchasePlanComponentRowViewModel } from '../purchase-plan-view.models';

/**
 * Presentational component row for a single item in the Purchase Review.
 *
 * Input-driven: receives an immutable PurchasePlanComponentRowViewModel.
 * Displays the API-backed product and links to the Builder or original store.
 */
@Component({
  selector: 'app-purchase-plan-row',
  standalone: true,
  imports: [RouterLink],
  inputs: ['row', 'buildPublicId'],
  template: `
    <article class="review-row" [attr.data-status]="row.compatibilityStatus">
      <div class="product-image-frame">
        @if (row.imageUrl) {
          <img class="product-image" [src]="row.imageUrl" [alt]="row.productName" />
        } @else {
          <span class="material-symbols-outlined image-fallback" aria-hidden="true">memory</span>
        }
      </div>

      <div class="product-identity">
        <span class="slot-name tech-font">{{ row.slotDisplayName }}</span>
        <h3 class="product-name">{{ row.productName }}</h3>
        <span class="availability tech-font">{{ row.availabilityLabel }}</span>
      </div>

      <div class="compatibility-block">
        <span class="field-label tech-font">Status</span>
        <span class="compatibility-value tech-font" [attr.data-status]="row.compatibilityStatus">
          <span class="material-symbols-outlined" aria-hidden="true">{{ statusIcon }}</span>
          {{ row.compatibilityStatusLabel }}
        </span>
        @if (row.compatibilityReason) {
          <span class="compatibility-reason">{{ row.compatibilityReason }}</span>
        }
      </div>

      <div class="price-block">
        <span class="field-label tech-font">Price</span>
        <strong class="price-value">{{ row.priceLabel }}</strong>
      </div>

      <div class="row-actions">
        <a class="replace-link tech-font" [routerLink]="['/builder', buildPublicId]">Replace</a>
        @if (row.sourceUrl) {
          <a
            class="store-link tech-font"
            [href]="row.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            [attr.aria-label]="'Open ' + row.productName + ' at ' + row.availabilityLabel">
            Open Store
            <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>
          </a>
        }
      </div>
    </article>
  `,
  styles: `
    .review-row {
      display: grid;
      grid-template-columns: 64px minmax(180px, 1fr) minmax(150px, 0.7fr) 130px auto;
      gap: 16px;
      align-items: center;
      min-height: 88px;
      padding: 12px;
      border: var(--border-width) solid var(--color-outline-variant);
      background: var(--color-surface-container);
      box-shadow: inset 3px 0 0 transparent;
    }
    .review-row[data-status="COMPATIBLE"] { box-shadow: inset 3px 0 0 var(--color-primary); }
    .review-row[data-status="WARNING"] { box-shadow: inset 3px 0 0 #e5b94f; }
    .review-row[data-status="INCOMPATIBLE"] { box-shadow: inset 3px 0 0 var(--color-error); }
    .product-image-frame {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      padding: 4px;
      overflow: hidden;
      border: var(--border-width) solid var(--color-outline-variant);
      background: #0d0f0d;
    }
    .product-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .image-fallback {
      color: var(--color-outline);
      font-size: 28px;
    }
    .product-identity,
    .compatibility-block,
    .price-block {
      display: flex;
      min-width: 0;
      flex-direction: column;
      justify-content: center;
    }
    .slot-name,
    .field-label,
    .availability {
      color: var(--color-on-surface-variant);
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .product-name {
      overflow: hidden;
      color: var(--color-on-surface);
      font-size: 15px;
      font-weight: 700;
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .availability {
      margin-top: 3px;
      color: var(--color-outline);
    }
    .compatibility-value {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--color-on-surface-variant);
      font-size: 11px;
    }
    .compatibility-value .material-symbols-outlined { font-size: 15px; }
    .compatibility-value[data-status="COMPATIBLE"] { color: var(--color-primary); }
    .compatibility-value[data-status="WARNING"] { color: #e5b94f; }
    .compatibility-value[data-status="INCOMPATIBLE"] { color: var(--color-error); }
    .compatibility-reason {
      overflow: hidden;
      color: var(--color-outline);
      font-size: 10px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .price-block { align-items: flex-end; }
    .price-value {
      color: var(--color-on-surface);
      font-size: 15px;
      white-space: nowrap;
    }
    .row-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
    }
    .replace-link,
    .store-link {
      color: var(--color-on-surface-variant);
      font-size: 10px;
      text-decoration: underline;
      text-decoration-color: var(--color-outline-variant);
      text-underline-offset: 4px;
    }
    .replace-link:hover,
    .store-link:hover { color: var(--color-primary); }
    .store-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .store-link .material-symbols-outlined { font-size: 14px; }

    @media (max-width: 1100px) {
      .review-row {
        grid-template-columns: 56px minmax(160px, 1fr) 120px auto;
      }
      .product-image-frame { width: 56px; height: 56px; }
      .compatibility-block { display: none; }
    }
    @media (max-width: 680px) {
      .review-row {
        grid-template-columns: 56px 1fr;
        gap: 12px;
      }
      .price-block {
        grid-column: 2;
        align-items: flex-start;
      }
      .row-actions {
        grid-column: 1 / -1;
        justify-content: stretch;
      }
      .replace-link,
      .store-link {
        flex: 1;
        justify-content: center;
        padding: 8px;
        border: var(--border-width) solid var(--color-outline-variant);
        text-decoration: none;
      }
    }
  `,
})
export class PurchasePlanRowComponent {
  row!: PurchasePlanComponentRowViewModel;
  buildPublicId: string | null = null;

  get statusIcon(): string {
    switch (this.row.compatibilityStatus) {
      case 'COMPATIBLE': return 'check_circle';
      case 'WARNING': return 'warning';
      case 'INCOMPATIBLE': return 'cancel';
      case 'UNKNOWN': return 'help';
    }
  }
}
