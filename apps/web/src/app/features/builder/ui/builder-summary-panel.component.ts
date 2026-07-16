import { Component, EventEmitter } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BuilderSlotComponent } from './builder-slot.component';
import type {
  BuilderSlotKey,
  BuilderSlotViewModel,
  BuilderSummaryViewModel,
  BuilderUiIntent,
} from '../builder-view.models';

/**
 * Presentational summary panel for the Builder workspace.
 *
 * Input-driven: receives an immutable BuilderSummaryViewModel.
 * Displays exactly what the wrapper provides via display labels.
 * Actions are disabled with visible reasons — no persistence, no compatibility
 * computation, no totals calculation.
 */
@Component({
  selector: 'app-builder-summary-panel',
  standalone: true,
  imports: [RouterLink, BuilderSlotComponent],
  inputs: ['summary', 'slots', 'publicId'],
  outputs: ['intent', 'slotClick', 'clearClick'],
  template: `
    <aside class="summary-panel" aria-label="Build summary">
      <header class="summary-header">
        <div class="summary-title-row">
          <h2 class="summary-heading">Build Summary</h2>
          <span class="material-symbols-outlined summary-heading-icon" aria-hidden="true">inventory_2</span>
        </div>
        <div class="progress-meta tech-font">
          <span>Build progress</span>
          <span class="stat-value">{{ summary.filledCount }} / {{ summary.slotCount }}</span>
        </div>
        <div
          class="progress-track"
          role="progressbar"
          aria-label="Build progress"
          [attr.aria-valuenow]="summary.filledCount"
          aria-valuemin="0"
          [attr.aria-valuemax]="summary.slotCount">
          <span class="progress-fill" [style.width.%]="progressPercent"></span>
        </div>
      </header>

      <div class="summary-slots" role="list" aria-label="Component slots">
        @for (slot of slots; track slot.key) {
          <div role="listitem">
            <app-builder-slot
              [slot]="slot"
              (slotClick)="slotClick.emit($event)"
              (clearClick)="clearClick.emit($event)" />
          </div>
        }
      </div>

      <footer class="summary-footer">
        <dl class="summary-total">
          <div>
            <dt>Estimated total</dt>
            <dd class="total-note">Current observed prices</dd>
          </div>
          <dd class="total-value stat-value" [class.stat-empty]="summary.totalEstimateLabel === null">
            {{ summary.totalEstimateLabel ?? '—' }}
          </dd>
        </dl>
        <div class="compatibility-summary tech-font">
          <span>Compatibility</span>
          <span class="stat-value">{{ summary.compatibilityStatusLabel ?? 'Unknown' }}</span>
        </div>
        <div class="summary-actions">
          <button class="summary-btn" type="button" disabled aria-label="Reset build unavailable">
            <span class="material-symbols-outlined" aria-hidden="true">delete</span>Reset
          </button>
          <button class="summary-btn" type="button" disabled aria-label="Save build unavailable">
            <span class="material-symbols-outlined" aria-hidden="true">save</span>Save
          </button>
          @if (publicId) {
            <a
              class="summary-btn purchase-btn"
              [routerLink]="['/purchase-plan']"
              [queryParams]="{ buildId: publicId }">
              <span class="material-symbols-outlined" aria-hidden="true">shopping_cart</span>
              Purchase plan
            </a>
          }
        </div>
        <span class="action-reason" role="note">Reset and Save are unavailable in the current Builder.</span>
      </footer>
    </aside>
  `,
  styles: `
    .summary-panel {
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 64px);
      height: calc(100vh - 64px);
      overflow: hidden;
      position: sticky;
      top: 64px;
      background-color: #0d0f0d;
      border-left: var(--border-width) solid rgba(68, 73, 51, 0.5);
      box-shadow: -20px 0 40px rgba(0, 0, 0, 0.35);
    }
    .summary-header {
      flex: 0 0 auto;
      padding: 24px 32px;
      border-bottom: var(--border-width) solid rgba(68, 73, 51, 0.45);
      background: var(--color-surface-container);
      box-shadow: inset 0 -10px 20px rgba(0, 0, 0, 0.18);
    }
    .summary-title-row,
    .progress-meta,
    .compatibility-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .summary-heading {
      font-size: 28px;
      font-weight: 600;
      color: var(--color-on-surface);
      text-transform: uppercase;
      letter-spacing: -0.03em;
    }
    .summary-heading-icon {
      color: var(--color-outline-variant);
      font-size: 28px;
    }
    .progress-meta {
      margin-top: 20px;
      color: var(--color-on-surface-variant);
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .progress-track {
      height: 4px;
      margin-top: 10px;
      overflow: hidden;
      background: var(--color-surface-container-highest, #343533);
    }
    .progress-fill {
      display: block;
      height: 100%;
      background: var(--color-primary);
      transition: width 0.3s ease;
    }
    .summary-slots {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 8px 0;
      scrollbar-color: var(--color-outline-variant) #0d0f0d;
      scrollbar-width: thin;
    }
    .summary-slots::-webkit-scrollbar {
      width: 6px;
    }
    .summary-slots::-webkit-scrollbar-track {
      background: #0d0f0d;
    }
    .summary-slots::-webkit-scrollbar-thumb {
      background: var(--color-outline-variant);
    }
    .stat-value {
      color: var(--color-on-surface);
      font-weight: 700;
    }
    .stat-empty {
      color: var(--color-on-surface-variant);
      font-weight: 400;
    }
    .summary-footer {
      display: flex;
      flex-direction: column;
      flex: 0 0 auto;
      gap: 12px;
      padding: 20px 32px 24px;
      border-top: var(--border-width) solid rgba(68, 73, 51, 0.45);
      background: var(--color-surface-container-low);
      box-shadow: inset 0 10px 20px rgba(0, 0, 0, 0.16);
    }
    .summary-total {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }
    .summary-total dt,
    .compatibility-summary {
      font-family: var(--font-mono);
      color: var(--color-on-surface-variant);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .total-note {
      margin-top: 4px;
      color: var(--color-outline);
      font-size: 11px;
    }
    .total-value {
      color: var(--color-primary);
      font-family: var(--font-mono);
      font-size: clamp(28px, 2.5vw, 48px);
      line-height: 1;
      text-align: right;
    }
    .summary-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .summary-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      padding: 10px 12px;
      border: var(--border-width) solid var(--color-outline-variant);
      background: transparent;
      color: var(--color-on-surface);
      font: 700 10px var(--font-mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .summary-btn .material-symbols-outlined {
      font-size: 16px;
    }
    .summary-btn:disabled {
      color: var(--color-outline);
      cursor: not-allowed;
      opacity: 0.55;
    }
    .purchase-btn {
      grid-column: 1 / -1;
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-on-primary);
    }
    .purchase-btn:hover,
    .purchase-btn:focus-visible {
      background: var(--color-primary-container);
      outline: none;
    }
    .action-reason {
      color: var(--color-outline);
      font: 10px var(--font-mono);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    @media (max-width: 1100px) {
      .summary-header,
      .summary-footer {
        padding-inline: 24px;
      }
    }
    @media (max-width: 768px) {
      .summary-panel {
        min-height: auto;
        height: auto;
        overflow: visible;
        position: static;
        border-top: var(--border-width) solid var(--color-outline-variant);
        border-left: 0;
        box-shadow: none;
      }
    }
  `,
})
export class BuilderSummaryPanelComponent {
  summary!: BuilderSummaryViewModel;
  slots: readonly BuilderSlotViewModel[] = [];
  publicId: string | null = null;
  intent = new EventEmitter<BuilderUiIntent>();
  slotClick = new EventEmitter<BuilderSlotKey>();
  clearClick = new EventEmitter<BuilderSlotKey>();

  get progressPercent(): number {
    return this.summary.slotCount === 0
      ? 0
      : (this.summary.filledCount / this.summary.slotCount) * 100;
  }
}
