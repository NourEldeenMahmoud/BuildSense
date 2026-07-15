import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, catchError, of, tap, map } from 'rxjs';
import { BuildService } from '../builder/data-access/build.service';
import type { PurchasePlanDto } from '@buildsense/contracts';
import {
  type PurchasePlanPageViewModel,
  type PurchasePlanComponentRowViewModel,
} from './purchase-plan-view.models';

// ---------------------------------------------------------------------------
// Page state
// ---------------------------------------------------------------------------

type PageStatus = 'loading' | 'loaded' | 'not-found' | 'error' | 'empty-build';

interface PurchasePlanPageState {
  status: PageStatus;
  plan: PurchasePlanDto | null;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Production Purchase Plan page.
 *
 * Reads `buildId` from query params and fetches the purchase plan.
 * Shows loading, empty, error, and filled states.
 * Source links open in a new tab with `rel="noopener noreferrer"`.
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

      <!-- Loading -->
      @if (status() === 'loading') {
        <div class="plan-loading" role="status" aria-label="Loading purchase plan">
          <div class="loading-spinner" aria-hidden="true"></div>
          <span class="loading-text tech-font">Loading purchase plan…</span>
        </div>
      }

      <!-- Not found -->
      @if (status() === 'not-found') {
        <div class="plan-error card" role="alert">
          <h2 class="error-heading">Build Not Found</h2>
          <p class="error-text">
            {{ errorMessage() || 'The requested build could not be found.' }}
          </p>
          <nav class="error-actions" aria-label="Recovery navigation">
            <a class="btn btn-primary" routerLink="/builder">
              Start New Build
            </a>
            <a class="btn btn-secondary" routerLink="/">
              Browse Catalog
            </a>
          </nav>
        </div>
      }

      <!-- Error -->
      @if (status() === 'error') {
        <div class="plan-error card" role="alert">
          <h2 class="error-heading">Error Loading Purchase Plan</h2>
          <p class="error-text">
            {{ errorMessage() || 'An unexpected error occurred.' }}
          </p>
          <div class="error-actions">
            <button class="btn btn-primary" (click)="retry()">Retry</button>
            <a class="btn btn-secondary" routerLink="/">Browse Catalog</a>
          </div>
        </div>
      }

      <!-- No build ID in query params -->
      @if (status() === 'empty-build') {
        <div class="no-build-state" aria-label="No build available">
          <div class="no-build-card card">
            <h2 class="no-build-heading">No build configured</h2>
            <p class="no-build-text">
              You do not have a PC build configured yet. The purchase plan
              summarizes your selected components, estimated totals, and
              retailer links once you've assembled a build.
            </p>

            <nav class="no-build-actions" aria-label="Getting started">
              <a class="btn btn-primary" routerLink="/builder">
                Go to Builder
              </a>
              <a class="btn btn-secondary" routerLink="/">
                Browse Catalog
              </a>
            </nav>
          </div>
        </div>
      }

      <!-- Loaded state — purchase plan table -->
      @if (status() === 'loaded' && vm()) {
        <div class="plan-content">
          <div class="plan-summary card">
            <dl class="plan-stats">
              <div class="stat-row">
                <dt class="stat-label">Components</dt>
                <dd class="stat-value tech-font">{{ vm()!.componentCount }}</dd>
              </div>
              <div class="stat-row">
                <dt class="stat-label">Estimated Total</dt>
                <dd class="stat-value">
                  {{ vm()!.totalPriceLabel ?? '—' }}
                </dd>
              </div>
            </dl>
          </div>

          <div class="plan-items card">
            <h2 class="items-heading">Components</h2>
            <table class="items-table" aria-label="Purchase plan components">
              <thead>
                <tr>
                  <th scope="col">Component</th>
                  <th scope="col">Product</th>
                  <th scope="col">Price</th>
                  <th scope="col">Availability</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                @for (row of vm()!.componentRows; track row.slotDisplayName) {
                  <tr>
                    <td class="cell-slot">{{ row.slotDisplayName }}</td>
                    <td class="cell-product">{{ row.productName }}</td>
                    <td class="cell-price tech-font">{{ row.priceLabel }}</td>
                    <td class="cell-availability">{{ row.availabilityLabel }}</td>
                    <td class="cell-source">
                      @if (row.sourceUrl) {
                        <a
                          class="source-link"
                          [href]="row.sourceUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          [attr.aria-label]="'Visit ' + row.slotDisplayName + ' on retailer'">
                          Visit Store
                        </a>
                      } @else {
                        <span class="no-source">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <nav class="plan-actions" aria-label="Plan actions">
            <a class="btn btn-secondary" routerLink="/builder">
              Back to Builder
            </a>
          </nav>
        </div>
      }
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

    /* Loading */
    .plan-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 200px;
    }
    .loading-text {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    .loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--color-surface-container-high);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Error / No build */
    .plan-error,
    .no-build-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .error-heading,
    .no-build-heading {
      font-size: 18px;
      font-weight: 600;
    }
    .error-text,
    .no-build-text {
      color: var(--color-on-surface-variant);
      font-size: 14px;
      line-height: 1.6;
    }
    .error-actions,
    .no-build-actions {
      display: flex;
      gap: var(--space-base);
      margin-top: var(--space-base);
    }

    /* Plan content */
    .plan-content {
      display: flex;
      flex-direction: column;
      gap: var(--space-gutter);
    }
    .plan-summary {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
      padding: var(--space-gutter);
    }
    .plan-stats {
      display: flex;
      gap: var(--space-gutter);
    }
    .stat-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .stat-label {
      font-size: 12px;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 700;
      color: var(--color-on-surface);
    }

    /* Items table */
    .plan-items {
      padding: var(--space-gutter);
    }
    .items-heading {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: var(--space-base);
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .items-table th {
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
      padding: var(--space-base) var(--space-gutter);
      border-bottom: var(--border-width) solid var(--color-border);
    }
    .items-table td {
      padding: var(--space-base) var(--space-gutter);
      border-bottom: var(--border-width) solid var(--color-border);
      color: var(--color-on-surface);
      vertical-align: middle;
    }
    .items-table tr:last-child td {
      border-bottom: none;
    }
    .cell-price {
      font-weight: 700;
      color: var(--color-primary);
    }
    .cell-availability {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
    }
    .source-link {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-primary);
      text-decoration: none;
    }
    .source-link:hover {
      text-decoration: underline;
    }
    .no-source {
      color: var(--color-on-surface-variant);
    }
    .plan-actions {
      display: flex;
      gap: var(--space-base);
    }
  `,
})
export class PurchasePlanPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly buildService = inject(BuildService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<PurchasePlanPageState>({
    status: 'empty-build',
    plan: null,
    errorMessage: null,
  });

  readonly status = computed(() => this.state().status);
  readonly errorMessage = computed(() => this.state().errorMessage);

  /** Derived view model from the loaded plan. */
  readonly vm = computed<PurchasePlanPageViewModel | null>(() => {
    const plan = this.state().plan;
    if (!plan) return null;

    const componentRows: PurchasePlanComponentRowViewModel[] = plan.items.map((item) => ({
      slotDisplayName: item.slot.toUpperCase(),
      productName: item.productName,
      priceLabel: item.totalPrice != null
        ? `${item.totalPrice.toLocaleString('en-US')} EGP`
        : '\u2014',
      availabilityLabel: item.availability ?? 'Unknown',
      sourceUrl: item.sourceUrl,
    }));

    return {
      hasBuild: true,
      componentCount: plan.itemCount,
      totalPriceLabel: plan.totalPrice != null
        ? `${plan.totalPrice.toLocaleString('en-US')} EGP`
        : null,
      compatibilityStatusLabel: null,
      componentRows,
    };
  });

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        map((params) => params.get('buildId') ?? null),
        takeUntilDestroyed(this.destroyRef),
        switchMap((buildId) => this.handleBuildId(buildId)),
      )
      .subscribe();
  }

  private handleBuildId(buildId: string | null): import('rxjs').Observable<unknown> {
    if (!buildId) {
      this.state.update(() => ({
        status: 'empty-build',
        plan: null,
        errorMessage: null,
      }));
      return of(null);
    }

    this.state.update((s) => ({
      ...s,
      status: 'loading',
      errorMessage: null,
    }));

    return this.buildService.getPurchasePlan(buildId).pipe(
      tap((plan) => {
        if (plan.items.length === 0) {
          this.state.update(() => ({
            status: 'loaded',
            plan,
            errorMessage: null,
          }));
        } else {
          this.state.update(() => ({
            status: 'loaded',
            plan,
            errorMessage: null,
          }));
        }
      }),
      catchError((err) => {
        const status = err?.status === 404 ? 'not-found' : 'error';
        const message =
          err?.status === 404
            ? 'Build not found.'
            : err?.error?.error ||
              err?.message ||
              'Failed to load purchase plan.';

        this.state.update(() => ({
          status,
          plan: null,
          errorMessage: message,
        }));
        return of(null);
      }),
    );
  }

  /** Retry loading the purchase plan with the current query params. */
  retry(): void {
    const buildId = this.route.snapshot.queryParamMap.get('buildId');
    this.handleBuildId(buildId).subscribe();
  }
}
