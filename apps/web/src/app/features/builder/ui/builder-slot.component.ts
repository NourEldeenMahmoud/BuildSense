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
      <button
        class="slot-select"
        type="button"
        [attr.aria-label]="slot.selectedProduct !== null ? 'Replace ' + slot.displayName : 'Add ' + slot.displayName"
        (click)="onSlotClick()">
        <span class="slot-icon material-symbols-outlined" aria-hidden="true">{{ icon }}</span>
        <span class="slot-content">
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
            <span class="slot-status tech-font">Required — not selected</span>
          }
        </span>
        @if (slot.selectedProduct !== null && slot.compatibilityStatusLabel) {
          <span
            class="compatibility-badge tech-font"
            [attr.data-status]="slot.compatibilityStatus"
            [attr.aria-label]="'Compatibility: ' + slot.compatibilityStatusLabel">
            {{ slot.compatibilityStatusLabel }}
          </span>
        }
      </button>
      @if (slot.selectedProduct !== null) {
        <button
          class="slot-clear material-symbols-outlined"
          type="button"
          [attr.aria-label]="'Clear ' + slot.displayName"
          (click)="onClear($event)">close</button>
      }
      @if ((slot.topReasons?.length ?? 0) > 0 || (slot.triggeredRuleIds?.length ?? 0) > 0) {
        <details class="compatibility-evidence">
          <summary>Compatibility details</summary>
          @for (reason of slot.topReasons ?? []; track reason) {
            <span>{{ reason }}</span>
          }
          @if ((slot.triggeredRuleIds?.length ?? 0) > 0) {
            <span class="tech-font">Rules: {{ (slot.triggeredRuleIds ?? []).join(', ') }}</span>
          }
        </details>
      }
    </div>
  `,
  styles: `
    .slot {
      position: relative;
      border-bottom: var(--border-width) solid rgba(68, 73, 51, 0.38);
      background: transparent;
    }
    .slot-filled {
      background-color: rgba(31, 32, 30, 0.42);
    }
    .slot-select {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      align-items: center;
      gap: 16px;
      width: 100%;
      min-height: 68px;
      padding: 10px 24px;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    .slot-select:hover,
    .slot-select:focus-visible {
      background-color: rgba(41, 42, 41, 0.58);
      outline: none;
    }
    .slot-select:focus-visible .slot-icon {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
    .slot-icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border: var(--border-width) solid var(--color-outline-variant);
      background: var(--color-surface-container);
      color: var(--color-outline);
      font-size: 18px;
    }
    .slot-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .slot-label {
      font-weight: 600;
      font-size: 16px;
      color: var(--color-on-surface);
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
      font-size: 11px;
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
      font-size: 11px;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .compatibility-badge {
      width: fit-content;
      padding: 4px 7px;
      font-size: 10px;
      text-transform: uppercase;
      border: var(--border-width) solid var(--color-outline-variant);
    }
    .compatibility-badge[data-status="COMPATIBLE"] { color: var(--color-success, #2e7d32); }
    .compatibility-badge[data-status="WARNING"] { color: var(--color-warning, #9a6700); }
    .compatibility-badge[data-status="INCOMPATIBLE"] { color: var(--color-error); }
    .compatibility-evidence {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0 32px 16px 88px;
      font-size: 11px;
      color: var(--color-on-surface-variant);
    }
    .compatibility-evidence summary { cursor: pointer; }
    .slot-clear {
      position: absolute;
      top: 12px;
      right: 8px;
      width: 28px;
      height: 28px;
      border: 0;
      background: transparent;
      color: var(--color-on-surface-variant);
      cursor: pointer;
      font-size: 17px;
    }
    .slot-clear:hover,
    .slot-clear:focus-visible {
      color: var(--color-error);
    }
  `,
})
export class BuilderSlotComponent {
  slot!: BuilderSlotViewModel;
  slotClick = new EventEmitter<BuilderSlotKey>();
  clearClick = new EventEmitter<BuilderSlotKey>();

  get icon(): string {
    return {
      cpu: 'memory',
      motherboard: 'developer_board',
      ram: 'dns',
      gpu: 'video_call',
      storage: 'hard_drive',
      psu: 'power',
      case: 'inventory_2',
    }[this.slot.key];
  }

  onSlotClick(): void {
    this.slotClick.emit(this.slot.key);
  }

  onClear(event: Event): void {
    event.stopPropagation();
    this.clearClick.emit(this.slot.key);
  }
}
