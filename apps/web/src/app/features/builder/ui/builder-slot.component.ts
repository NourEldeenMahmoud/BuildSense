import { Component, EventEmitter } from '@angular/core';
import type { BuilderSlotViewModel, BuilderSlotKey } from '../builder-view.models';

/**
 * Presentational component for a single builder slot.
 *
 * Input-driven: receives an immutable BuilderSlotViewModel.
 * When selectedProduct is null, renders an empty slot with an "Add" button.
 * When selectedProduct is provided, renders the product name, price, and
 * availability exactly as supplied by the wrapper — no computation.
 * Emits 'slotClick' with the slot key when the slot area is clicked.
 * Emits 'clearClick' with the slot key when the clear button is clicked.
 */
@Component({
  selector: 'app-builder-slot',
  standalone: true,
  inputs: ['slot'],
  outputs: ['slotClick', 'clearClick'],
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
        <div class="slot-actions">
          @if (slot.selectedProduct !== null) {
            <button
              class="slot-btn slot-btn-clear"
              type="button"
              [attr.aria-label]="'Clear ' + slot.displayName"
              (click)="onClear($event)">
              ✕
            </button>
          }
          <button
            class="slot-btn slot-btn-add"
            type="button"
            [attr.aria-label]="slot.selectedProduct !== null ? 'Replace ' + slot.displayName : 'Add ' + slot.displayName"
            (click)="onSlotClick()">
            {{ slot.selectedProduct !== null ? 'Replace' : 'Add' }}
          </button>
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
    .slot-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
      margin-left: var(--space-base);
    }
    .slot-btn {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: var(--border-width) solid var(--color-outline-variant);
      border-radius: var(--radius-none);
      background: transparent;
      color: var(--color-on-surface-variant);
      cursor: pointer;
      white-space: nowrap;
    }
    .slot-btn-add {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
    .slot-btn-clear {
      border-color: var(--color-outline-variant);
      color: var(--color-on-surface-variant);
      padding: 4px 6px;
    }
    .slot-btn:hover {
      opacity: 0.8;
    }
  `,
})
export class BuilderSlotComponent {
  slot!: BuilderSlotViewModel;
  slotClick = new EventEmitter<BuilderSlotKey>();
  clearClick = new EventEmitter<BuilderSlotKey>();

  onSlotClick(): void {
    this.slotClick.emit(this.slot.key);
  }

  onClear(event: Event): void {
    event.stopPropagation();
    this.clearClick.emit(this.slot.key);
  }
}
