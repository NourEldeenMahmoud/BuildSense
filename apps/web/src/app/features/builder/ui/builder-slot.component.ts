import { Component } from '@angular/core';
import type { BuilderSlotViewModel } from '../builder-view.models';

/**
 * Presentational component for a single builder slot.
 *
 * Input-driven: receives an immutable BuilderSlotViewModel.
 * When selectedProduct is null, renders an empty slot with status "Empty".
 * When selectedProduct is provided, renders the product name, price, and
 * availability exactly as supplied by the wrapper — no computation.
 * No fixture data, no persistence, no compatibility logic.
 */
@Component({
  selector: 'app-builder-slot',
  standalone: true,
  inputs: ['slot'],
  template: `
    <div
      class="slot"
      [class.slot-filled]="slot.selectedProduct !== null"
      role="group"
      [attr.aria-labelledby]="'slot-label-' + slot.key">
      <span class="slot-ordinal tech-font" aria-hidden="true">{{ slot.ordinal }}</span>
      <div class="slot-body">
        <div class="slot-content">
          <span class="slot-label" [id]="'slot-label-' + slot.key">
            {{ slot.displayName }}
          </span>
          @if (slot.selectedProduct !== null) {
            <span class="slot-product-name">{{ slot.selectedProduct.name }}</span>
            <div class="slot-product-meta">
              <span class="slot-price tech-font">{{ slot.selectedProduct.priceLabel }}</span>
              <span class="slot-availability">{{ slot.selectedProduct.availabilityLabel }}</span>
            </div>
          } @else {
            <span class="slot-status tech-font">Empty</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .slot {
      display: flex;
      align-items: center;
      gap: var(--space-base);
      padding: var(--space-base) var(--space-gutter);
      background-color: var(--color-surface-container-low);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-none);
      min-height: 56px;
    }
    .slot-filled {
      background-color: var(--color-surface-container);
    }
    .slot-ordinal {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-on-surface-variant);
      background-color: var(--color-surface-container);
      border: var(--border-width) solid var(--color-outline-variant);
      flex-shrink: 0;
    }
    .slot-body {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex: 1;
      min-width: 0;
    }
    .slot-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }
    .slot-label {
      font-weight: 600;
      font-size: 14px;
      color: var(--color-on-surface);
      letter-spacing: 0.02em;
    }
    .slot-product-name {
      font-size: 13px;
      color: var(--color-on-surface-variant);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .slot-product-meta {
      display: flex;
      align-items: center;
      gap: var(--space-base);
    }
    .slot-price {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-primary);
    }
    .slot-availability {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
    }
    .slot-status {
      font-size: 12px;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  `,
})
export class BuilderSlotComponent {
  slot!: BuilderSlotViewModel;
}
