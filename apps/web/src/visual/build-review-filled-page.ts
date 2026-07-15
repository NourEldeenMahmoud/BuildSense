import { Component } from '@angular/core';
import { PurchasePlanRowComponent } from '../app/features/purchase-plan/ui/purchase-plan-row.component';
import { PurchasePlanReviewSummaryComponent } from '../app/features/purchase-plan/ui/purchase-plan-review-summary.component';
import { FIXTURE_PURCHASE_PLAN_VM } from './fixtures/purchase-plan-fixtures';

/**
 * Visual-only wrapper: filled Build Review / Purchase Plan composition.
 *
 * Composes production presentational components with fixture data.
 * This component is ONLY loaded by the visual-test configuration and
 * must never be imported by production routes or production entry points.
 */
@Component({
  selector: 'app-visual-build-review-filled',
  standalone: true,
  imports: [PurchasePlanRowComponent, PurchasePlanReviewSummaryComponent],
  template: `
    <main class="review-page app-container" role="main" aria-labelledby="review-heading">
      <header class="page-header">
        <h1 id="review-heading">Purchase Plan</h1>
        <p class="page-subtitle">
          Review your build configuration and plan purchases from retailers.
        </p>
      </header>

      <div class="review-layout">
        <section class="review-rows-section" aria-label="Component details">
          <h2 class="section-heading">Components</h2>
          <div class="review-rows" role="table" aria-label="Build components">
            @for (row of vm.componentRows; track row.slotDisplayName) {
              <app-purchase-plan-row [row]="row" />
            }
          </div>
        </section>

        <app-purchase-plan-review-summary [vm]="vm" />
      </div>
    </main>
  `,
  styles: `
    .review-page {
      padding-top: var(--space-gutter);
      padding-bottom: var(--space-margin-desktop);
      display: flex;
      flex-direction: column;
      gap: var(--space-gutter);
    }
    .page-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .page-subtitle {
      color: var(--color-on-surface-variant);
      font-size: 14px;
      max-width: 640px;
    }
    .review-layout {
      display: flex;
      flex-direction: column;
      gap: var(--space-gutter);
    }
    @media (min-width: 769px) {
      .review-layout {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: var(--space-gutter);
        align-items: start;
      }
    }
    .review-rows-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .section-heading {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-on-surface);
    }
    .review-rows {
      background-color: var(--color-surface-container);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-none);
    }
  `,
})
export class VisualBuildReviewFilledPage {
  protected readonly vm = FIXTURE_PURCHASE_PLAN_VM;
}
