import { Component, EventEmitter } from '@angular/core';
import { ButtonComponent } from '../../../shared/components/button.component';
import type { BuilderSummaryViewModel, BuilderUiIntent } from '../builder-view.models';

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
  imports: [ButtonComponent],
  inputs: ['summary'],
  outputs: ['intent'],
  template: `
    <aside class="summary-panel" aria-label="Build summary">
      <h2 class="summary-heading">Build Summary</h2>

      <dl class="summary-stats">
        <div class="stat-row">
          <dt class="stat-label">Components</dt>
          <dd class="stat-value tech-font">{{ summary.filledCount }} / {{ summary.slotCount }}</dd>
        </div>
        <div class="stat-row">
          <dt class="stat-label">Estimated Total</dt>
          <dd class="stat-value" [class.stat-empty]="summary.totalEstimateLabel === null">
            @if (summary.totalEstimateLabel !== null) {
              {{ summary.totalEstimateLabel }}
            } @else {
              Not available
            }
          </dd>
        </div>
        <div class="stat-row">
          <dt class="stat-label">Compatibility</dt>
          <dd class="stat-value" [class.stat-empty]="summary.compatibilityStatusLabel === null">
            @if (summary.compatibilityStatusLabel !== null) {
              {{ summary.compatibilityStatusLabel }}
            } @else {
              Deferred
            }
          </dd>
        </div>
      </dl>

      <div class="summary-actions">
        <app-button
          [disabled]="true"
          ariaLabel="Save build — not yet available">
          Save Build
        </app-button>
        <span class="action-reason" role="note">
          Available later when Builder is functional.
        </span>

        <app-button
          variant="secondary"
          [disabled]="true"
          ariaLabel="Review build — not yet available">
          Review &amp; Purchase
        </app-button>
        <span class="action-reason" role="note">
          Requires completed components and compatibility engine.
        </span>
      </div>
    </aside>
  `,
  styles: `
    .summary-panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-gutter);
      padding: var(--space-gutter);
      background-color: var(--color-surface-container);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-none);
    }
    .summary-heading {
      font-size: 18px;
      font-weight: 600;
      color: var(--color-on-surface);
    }
    .summary-stats {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-bottom: var(--space-base);
      border-bottom: var(--border-width) solid var(--color-border);
    }
    .stat-label {
      font-size: 14px;
      color: var(--color-on-surface-variant);
    }
    .stat-value {
      font-size: 14px;
      color: var(--color-on-surface);
      font-weight: 700;
    }
    .stat-empty {
      color: var(--color-on-surface-variant);
      font-weight: 400;
    }
    .summary-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .action-reason {
      font-size: 12px;
      color: var(--color-on-surface-variant);
      font-style: italic;
    }
  `,
})
export class BuilderSummaryPanelComponent {
  summary!: BuilderSummaryViewModel;
  intent = new EventEmitter<BuilderUiIntent>();
}
