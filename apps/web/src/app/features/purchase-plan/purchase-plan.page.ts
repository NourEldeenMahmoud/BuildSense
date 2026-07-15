import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  createPurchasePlanPageViewModel,
  type PurchasePlanUiIntent,
} from './purchase-plan-view.models';

/**
 * Production Purchase Plan page.
 *
 * Truthful no-build state: honestly explains that no build exists, and
 * provides navigation to the Builder and Catalog. No component rows,
 * no prices, no availability, no totals, no export, no saved-build or
 * compatibility claims, no API calls.
 */
@Component({
  selector: 'app-purchase-plan',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="purchase-plan-page app-container" role="region" aria-labelledby="purchase-plan-heading">
      <header class="page-header">
        <h1 id="purchase-plan-heading">Purchase Plan</h1>
        <p class="page-subtitle">
          Review your build and plan purchases from compatible retailers.
        </p>
      </header>

      <section class="no-build-state" aria-label="No build available">
        <div class="no-build-card card">
          <h2 class="no-build-heading">No build configured</h2>
          <p class="no-build-text">
            You do not have a PC build configured yet. The purchase plan
            summarizes your selected components, estimated totals, and
            retailer links once the Builder and compatibility engine are
            available.
          </p>
          <p class="no-build-text">
            Start by assembling a configuration in the Builder, or browse
            the catalog to research components.
          </p>

          <nav class="no-build-actions" aria-label="Getting started">
            <a class="btn btn-primary" routerLink="/builder">
              Go to Builder
            </a>
            <a class="btn btn-secondary" routerLink="/">
              Browse Catalog
            </a>
          </nav>

          <div class="no-build-disclaimer" role="note">
            <p class="disclaimer-text">
              The following capabilities are deferred to later milestones:
            </p>
            <ul class="disclaimer-list">
              <li>Component summary and row listing</li>
              <li>Price estimation and totals</li>
              <li>Availability and retailer links</li>
              <li>Compatibility status and recommendations</li>
              <li>Print and export controls</li>
            </ul>
          </div>
        </div>
      </section>
    </section>
  `,
  styles: `
    .purchase-plan-page {
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
    .no-build-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .no-build-heading {
      font-size: 18px;
      font-weight: 600;
    }
    .no-build-text {
      color: var(--color-on-surface-variant);
      font-size: 14px;
      line-height: 1.6;
    }
    .no-build-actions {
      display: flex;
      gap: var(--space-base);
      margin-top: var(--space-base);
      flex-wrap: wrap;
    }
    .no-build-disclaimer {
      margin-top: var(--space-base);
      padding-top: var(--space-base);
      border-top: var(--border-width) solid var(--color-border);
    }
    .disclaimer-text {
      font-size: 13px;
      color: var(--color-on-surface-variant);
      margin-bottom: var(--space-base);
    }
    .disclaimer-list {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .disclaimer-list li {
      font-size: 13px;
      color: var(--color-on-surface-variant);
      padding-left: var(--space-gutter);
      position: relative;
    }
    .disclaimer-list li::before {
      content: '\\2014';
      position: absolute;
      left: 0;
      color: var(--color-outline);
    }
  `,
})
export class PurchasePlanPage {
  protected readonly vm = createPurchasePlanPageViewModel();

  onIntent(_intent: PurchasePlanUiIntent): void {
    // No persistence or API intent handling in production checkpoint 1.
  }
}
