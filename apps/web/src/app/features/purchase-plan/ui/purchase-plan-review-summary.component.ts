import { Component, EventEmitter } from '@angular/core';
import type { PurchasePlanPageViewModel } from '../purchase-plan-view.models';

/**
 * Presentational summary panel for the Purchase Review.
 *
 * Input-driven: receives an immutable PurchasePlanPageViewModel.
 * Displays API-backed totals and emits client-side document actions.
 */
@Component({
  selector: 'app-purchase-plan-review-summary',
  standalone: true,
  inputs: ['vm'],
  outputs: ['exportPlan', 'printPlan', 'pdfPlan'],
  template: `
    <aside class="review-summary" aria-label="Build summary">
      <h2 class="summary-heading">Build Summary</h2>

      <dl class="summary-stats">
        <div class="stat-row">
          <dt class="stat-label tech-font">Components Selected</dt>
          <dd class="stat-value tech-font">{{ vm.componentCount }} / {{ vm.componentTarget }}</dd>
        </div>
        <div class="stat-row">
          <dt class="stat-label tech-font">Products Scanned</dt>
          <dd class="stat-value tech-font" [class.stat-empty]="vm.productsScannedLabel === null">
            {{ vm.productsScannedLabel ?? 'Not reported' }}
          </dd>
        </div>
      </dl>

      <div class="total-block">
        <span class="total-label tech-font">Estimated Total</span>
        <strong class="total-value" [class.stat-empty]="vm.totalPriceLabel === null">
          {{ vm.totalPriceLabel ?? 'Not available' }}
        </strong>
      </div>

      <p class="disclaimer-text tech-font" role="note">
        Disclaimer: Prices and availability may change on the original store. This estimate uses the latest data returned for this build.
      </p>

      <div class="summary-actions">
        <button class="export-button tech-font" type="button" (click)="exportPlan.emit()">
          <span class="material-symbols-outlined" aria-hidden="true">download</span>
          Export Plan
        </button>
        <div class="document-actions">
          <button class="document-button tech-font" type="button" (click)="printPlan.emit()">
            <span class="material-symbols-outlined" aria-hidden="true">print</span>
            Print
          </button>
          <button class="document-button tech-font" type="button" (click)="pdfPlan.emit()">
            <span class="material-symbols-outlined" aria-hidden="true">picture_as_pdf</span>
            PDF
          </button>
        </div>
      </div>
    </aside>
  `,
  styles: `
    .review-summary {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 480px;
      padding: var(--space-gutter);
      background-color: var(--color-surface-container);
      border: var(--border-width) solid var(--color-outline-variant);
      box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.3);
    }
    .summary-heading {
      padding-bottom: 12px;
      border-bottom: var(--border-width) solid var(--color-outline-variant);
      font-size: 20px;
      font-weight: 700;
      color: var(--color-on-surface);
    }
    .summary-stats {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 11px 0;
      border-bottom: var(--border-width) solid rgba(68, 73, 51, 0.65);
    }
    .stat-label {
      font-size: 10px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-on-surface-variant);
    }
    .stat-value {
      font-size: 11px;
      color: var(--color-on-surface);
      font-weight: 700;
    }
    .stat-empty {
      color: var(--color-on-surface-variant);
      font-weight: 400;
    }
    .total-block {
      display: flex;
      flex-direction: column;
      margin-top: 8px;
      padding-top: 16px;
      border-top: var(--border-width) solid var(--color-outline-variant);
    }
    .total-label {
      color: var(--color-on-surface-variant);
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .total-value {
      color: var(--color-primary);
      font-size: clamp(32px, 3vw, 48px);
      font-weight: 700;
      line-height: 1.05;
      letter-spacing: -0.035em;
      word-break: break-word;
    }
    .disclaimer-text {
      margin-top: auto;
      font-size: 9px;
      color: var(--color-on-surface-variant);
      line-height: 1.5;
    }
    .summary-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .export-button,
    .document-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      border: var(--border-width) solid var(--color-outline-variant);
      border-radius: 0;
      background: transparent;
      color: var(--color-on-surface);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .export-button {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-on-primary);
    }
    .export-button:hover { background: #b9e400; }
    .document-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .document-button:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
    .export-button .material-symbols-outlined,
    .document-button .material-symbols-outlined { font-size: 16px; }
    @media (max-width: 900px) {
      .review-summary { min-height: auto; }
      .disclaimer-text { margin-top: 8px; }
    }
  `,
})
export class PurchasePlanReviewSummaryComponent {
  vm!: PurchasePlanPageViewModel;
  exportPlan = new EventEmitter<void>();
  printPlan = new EventEmitter<void>();
  pdfPlan = new EventEmitter<void>();
}
