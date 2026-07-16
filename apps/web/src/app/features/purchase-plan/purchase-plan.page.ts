import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, catchError, of, tap, map, forkJoin } from 'rxjs';
import { BuildService } from '../builder/data-access/build.service';
import type { BuildDto, PurchasePlanDto } from '@buildsense/contracts';
import {
  type PurchasePlanPageViewModel,
  mapPurchasePlanPageViewModel,
} from './purchase-plan-view.models';
import { PurchasePlanRowComponent } from './ui/purchase-plan-row.component';
import { PurchasePlanReviewSummaryComponent } from './ui/purchase-plan-review-summary.component';
import { setLatestBuildId } from '../../core/storage';

// ---------------------------------------------------------------------------
// Page state
// ---------------------------------------------------------------------------

type PageStatus = 'loading' | 'loaded' | 'not-found' | 'error' | 'empty-build';

interface PurchasePlanPageState {
  status: PageStatus;
  plan: PurchasePlanDto | null;
  build: BuildDto | null;
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
  imports: [RouterLink, PurchasePlanRowComponent, PurchasePlanReviewSummaryComponent],
  template: `
    <section
      class="purchase-plan-page app-container"
      [class.has-loaded-plan]="status() === 'loaded' && vm() !== null"
      role="region"
      aria-labelledby="purchase-plan-heading">
      <header class="page-header">
        <div class="header-copy">
          <h1 id="purchase-plan-heading">Build Review</h1>
          @if (status() === 'loaded' && vm()) {
            <p class="build-status tech-font">
              <span class="status-dot" aria-hidden="true"></span>
              Status: {{ vm()!.buildStatusLabel }}
            </p>
          } @else {
            <p class="page-subtitle">Review your selected components and retailer purchase links.</p>
          }
        </div>
        @if (status() === 'loaded' && vm()) {
          <div class="header-actions">
            <a class="header-action" [routerLink]="['/builder', vm()!.buildPublicId]">
              <span class="material-symbols-outlined" aria-hidden="true">edit</span>
              Edit Build
            </a>
            <button class="header-action save-action" type="button" (click)="saveBuild()">
              <span class="material-symbols-outlined" aria-hidden="true">save</span>
              {{ saveMessage() ?? 'Save Build' }}
            </button>
          </div>
        }
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

      <!-- Loaded state -->
      @if (status() === 'loaded' && vm()) {
        <section
          class="compatibility-summary"
          [attr.data-status]="vm()!.compatibilityStatus"
          aria-labelledby="compatibility-heading">
          <div class="compatibility-icon">
            <span class="material-symbols-outlined" aria-hidden="true">{{ compatibilityIcon }}</span>
          </div>
          <div>
            <h2 id="compatibility-heading">{{ vm()!.compatibilityHeading }}</h2>
            <p>{{ vm()!.compatibilityDescription }}</p>
          </div>
        </section>

        <div class="review-layout">
          <section class="component-list" aria-labelledby="component-list-heading">
            <h2 id="component-list-heading" class="component-list-heading tech-font">
              System Blueprint [{{ vm()!.componentCount }} Components]
            </h2>
            <div class="component-cards">
              @for (row of vm()!.componentRows; track row.productId) {
                <app-purchase-plan-row [row]="row" [buildPublicId]="vm()!.buildPublicId" />
              } @empty {
                <div class="empty-components">No selected components are available for this build.</div>
              }
            </div>
          </section>

          <app-purchase-plan-review-summary
            [vm]="vm()!"
            (exportPlan)="exportPlan()"
            (printPlan)="printPlan()"
            (pdfPlan)="printPlan()" />
        </div>
      }
    </section>
  `,
  styles: `
    .purchase-plan-page {
      position: relative;
      padding-top: 16px;
      padding-bottom: var(--space-margin-desktop);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .page-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: var(--border-width) solid var(--color-outline-variant);
    }
    .page-header h1 {
      font-size: clamp(38px, 5vw, 64px);
      letter-spacing: -0.03em;
    }
    .header-copy { min-width: 0; }
    .build-status {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-top: 4px;
      color: var(--color-primary);
      font-size: 10px;
      letter-spacing: 0.04em;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-primary);
      box-shadow: 0 0 10px rgba(209, 255, 0, 0.45);
    }
    .page-subtitle {
      color: var(--color-on-surface-variant);
      font-size: 14px;
      max-width: 640px;
    }
    .header-actions {
      display: flex;
      gap: 8px;
    }
    .header-action {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 36px;
      padding: 8px 12px;
      border: 0;
      background: transparent;
      color: var(--color-on-surface);
      font: 700 11px var(--font-mono);
      cursor: pointer;
    }
    .header-action:hover { color: var(--color-primary); }
    .header-action .material-symbols-outlined { font-size: 17px; }
    .save-action { border: var(--border-width) solid var(--color-outline-variant); }

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

    .compatibility-summary {
      position: relative;
      display: flex;
      align-items: center;
      gap: 18px;
      padding: var(--space-gutter);
      overflow: hidden;
      border: var(--border-width) solid var(--color-outline-variant);
      background: linear-gradient(90deg, rgba(209, 255, 0, 0.05), transparent 45%), var(--color-surface-container);
    }
    .compatibility-summary::before {
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--status-color, var(--color-outline));
      content: '';
    }
    .compatibility-summary[data-status="COMPATIBLE"] { --status-color: var(--color-primary); }
    .compatibility-summary[data-status="WARNING"] { --status-color: #e5b94f; }
    .compatibility-summary[data-status="INCOMPATIBLE"] { --status-color: var(--color-error); }
    .compatibility-icon {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      flex: 0 0 48px;
      border: var(--border-width) solid var(--status-color, var(--color-outline));
      border-radius: 50%;
      color: var(--status-color, var(--color-outline));
      background: rgba(0, 0, 0, 0.16);
    }
    .compatibility-icon .material-symbols-outlined { font-size: 27px; }
    .compatibility-summary h2 {
      margin-bottom: 2px;
      font-size: 20px;
    }
    .compatibility-summary p {
      color: var(--color-on-surface-variant);
      font-size: 13px;
    }
    .review-layout {
      min-width: 0;
    }
    .component-list { min-width: 0; }
    .component-list-heading {
      margin: 10px 0 10px;
      color: var(--color-on-surface-variant);
      font-size: 10px;
      font-weight: 400;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .component-cards {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    app-purchase-plan-review-summary {
      position: absolute;
      top: 16px;
      right: var(--space-margin-desktop);
      width: 320px;
    }
    .has-loaded-plan .page-header,
    .has-loaded-plan .compatibility-summary,
    .has-loaded-plan .review-layout {
      margin-right: 344px;
    }
    .empty-components {
      padding: 32px;
      border: var(--border-width) solid var(--color-outline-variant);
      color: var(--color-on-surface-variant);
      text-align: center;
    }
    @media (max-width: 900px) {
      .has-loaded-plan .page-header,
      .has-loaded-plan .compatibility-summary,
      .has-loaded-plan .review-layout { margin-right: 0; }
      app-purchase-plan-review-summary {
        position: static;
        display: block;
        width: auto;
        margin-top: 24px;
      }
    }
    @media (max-width: 680px) {
      .purchase-plan-page { padding-bottom: 24px; }
      .page-header { align-items: flex-start; flex-direction: column; }
      .page-header h1 { font-size: 40px; }
      .header-actions { width: 100%; }
      .header-action { flex: 1; justify-content: center; }
      .compatibility-summary { align-items: flex-start; padding: 16px; }
      .compatibility-icon { width: 40px; height: 40px; flex-basis: 40px; }
    }
    @media print {
      .header-actions { display: none; }
      app-purchase-plan-review-summary { position: static; }
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
    build: null,
    errorMessage: null,
  });

  readonly status = computed(() => this.state().status);
  readonly errorMessage = computed(() => this.state().errorMessage);

  /** Derived view model from the loaded plan. */
  readonly vm = computed<PurchasePlanPageViewModel | null>(() => {
    const plan = this.state().plan;
    const build = this.state().build;
    return plan && build ? mapPurchasePlanPageViewModel(build, plan) : null;
  });

  readonly saveMessage = signal<string | null>(null);

  get compatibilityIcon(): string {
    switch (this.vm()?.compatibilityStatus) {
      case 'COMPATIBLE': return 'check_circle';
      case 'WARNING': return 'warning';
      case 'INCOMPATIBLE': return 'cancel';
      default: return 'help';
    }
  }

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
        build: null,
        errorMessage: null,
      }));
      return of(null);
    }

    this.state.update((s) => ({
      ...s,
      status: 'loading',
      errorMessage: null,
    }));

    return forkJoin({
      plan: this.buildService.getPurchasePlan(buildId),
      build: this.buildService.getBuild(buildId),
    }).pipe(
      tap(({ plan, build }) => {
        this.state.update(() => ({
          status: 'loaded',
          plan,
          build,
          errorMessage: null,
        }));
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
          build: null,
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

  saveBuild(): void {
    const buildId = this.vm()?.buildPublicId;
    if (!buildId) return;
    setLatestBuildId(buildId);
    this.saveMessage.set('Build Saved');
  }

  exportPlan(): void {
    const plan = this.state().plan;
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `buildsense-plan-${plan.buildPublicId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  printPlan(): void {
    window.print();
  }
}
