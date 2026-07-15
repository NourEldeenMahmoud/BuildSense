import { Component } from '@angular/core';
import { ButtonComponent } from '../../../shared/components/button.component';
import type { PurchasePlanPageViewModel } from '../purchase-plan-view.models';

/**
 * Presentational summary panel for the Purchase Review.
 *
 * Input-driven: receives an immutable PurchasePlanPageViewModel.
 * Displays totals, compatibility status, and disclaimer with disabled
 * print/export controls — all visible as "Available later".
 * No export, no print, no persistence, no API calls, no checkout.
 */
@Component({
  selector: 'app-purchase-plan-review-summary',
  standalone: true,
  imports: [ButtonComponent],
  inputs: ['vm'],
  template: `
    <aside class="review-summary" aria-label="Purchase review summary">
      <h2 class="summary-heading">Review Summary</h2>

      <dl class="summary-stats">
        <div class="stat-row">
          <dt class="stat-label">Components</dt>
          <dd class="stat-value tech-font">{{ vm.componentCount }} / 7</dd>
        </div>
        <div class="stat-row">
          <dt class="stat-label">Estimated Total</dt>
          <dd class="stat-value" [class.stat-empty]="vm.totalPriceLabel === null">
            @if (vm.totalPriceLabel !== null) {
              {{ vm.totalPriceLabel }}
            } @else {
              Not available
            }
          </dd>
        </div>
        <div class="stat-row">
          <dt class="stat-label">Compatibility</dt>
          <dd class="stat-value" [class.stat-empty]="vm.compatibilityStatusLabel === null">
            @if (vm.compatibilityStatusLabel !== null) {
              {{ vm.compatibilityStatusLabel }}
            } @else {
              Deferred
            }
          </dd>
        </div>
      </dl>

      <div class="summary-disclaimer" role="note">
        <p class="disclaimer-text">
          Prices and availability are display-only estimates from the Builder
          configuration. Actual prices may vary at the retailer.
        </p>
      </div>

      <div class="summary-actions">
        <app-button
          [disabled]="true"
          ariaLabel="Print plan — not yet available">
          Print Plan
        </app-button>
        <span class="action-reason" role="note">
          Available later when print support is implemented.
        </span>

        <app-button
          variant="secondary"
          [disabled]="true"
          ariaLabel="Export plan — not yet available">
          Export Plan
        </app-button>
        <span class="action-reason" role="note">
          Available later when export support is implemented.
        </span>
      </div>
    </aside>
  `,
  styles: `
    .review-summary {
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
    .summary-disclaimer {
      padding: var(--space-base);
      background-color: var(--color-surface-container-low);
      border: var(--border-width) solid var(--color-border);
    }
    .disclaimer-text {
      font-size: 12px;
      color: var(--color-on-surface-variant);
      line-height: 1.6;
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
export class PurchasePlanReviewSummaryComponent {
  vm!: PurchasePlanPageViewModel;
}
