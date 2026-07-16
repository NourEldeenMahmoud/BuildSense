import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/services/admin-api.service';
import type {
  AdminDashboardResponse,
  AdminWorkerStatusResponse,
  AdminCatalogStatsResponse,
} from '@buildsense/contracts';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <!-- Loading skeleton -->
    @if (dashState() === 'loading') {
      <div class="metrics-grid">
        @for (i of [1,2,3,4]; track i) {
          <div class="metric-card">
            <div class="skeleton-label"></div>
            <div class="skeleton-value"></div>
            <div class="skeleton-bar"></div>
          </div>
        }
      </div>
      <div class="panels-grid">
        <div class="panel panel-wide">
          <div class="panel-header"><div class="skeleton-label" style="width:200px"></div></div>
          <div class="panel-body">
            <div class="skeleton-table-row" *ngFor="let r of [1,2,3]"></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><div class="skeleton-label" style="width:140px"></div></div>
          <div class="panel-body">
            <div class="skeleton-table-row" *ngFor="let r of [1,2,3]"></div>
          </div>
        </div>
      </div>
    }

    <!-- Error state -->
    @if (dashState() === 'error') {
      <div class="error-panel">
        <span class="material-symbols-outlined error-icon">bolt</span>
        <h3 class="error-title">Failed to load dashboard</h3>
        <p class="error-message">{{ errorMessage() }}</p>
        <button class="retry-btn" (click)="load()">
          <span class="material-symbols-outlined" style="font-size:16px;">refresh</span>
          RETRY
        </button>
      </div>
    }

    <!-- Loaded state -->
    @if (dashState() === 'loaded' && dashboard()) {
      <!-- Metric cards -->
      <div class="metrics-grid">
        <!-- Total Scrape Runs -->
        <div class="metric-card">
          <h3 class="metric-label">TOTAL SCRAPE RUNS</h3>
          <div class="metric-row">
            <span class="metric-value">{{ dashboard()!.scrapeRuns.total | number }}</span>
          </div>
          <div class="metric-bar">
            <div class="metric-bar-fill metric-bar-fill--primary" [style.width]="scrapeBarWidth()"></div>
          </div>
        </div>

        <!-- Total Products -->
        <div class="metric-card">
          <h3 class="metric-label">TOTAL PRODUCTS</h3>
          <div class="metric-row">
            <span class="metric-value">{{ dashboard()!.catalog.totalProducts | number }}</span>
          </div>
          <div class="metric-bar">
            <div class="metric-bar-fill metric-bar-fill--primary" [style.width]="'100%'"></div>
          </div>
        </div>

        <!-- Compatibility Categories -->
        <div class="metric-card">
          <h3 class="metric-label">COMPAT CATEGORIES</h3>
          <div class="metric-row">
            <span class="metric-value">{{ dashboard()!.compatibilityQuality.totalCategories | number }}</span>
          </div>
          <div class="metric-bar">
            <div
              class="metric-bar-fill"
              [class.metric-bar-fill--primary]="compatPassRatio() >= 0.5"
              [class.metric-bar-fill--warning]="compatPassRatio() < 0.5 && compatPassRatio() >= 0.25"
              [class.metric-bar-fill--error]="compatPassRatio() < 0.25"
              [style.width]="compatBarWidth()"
            ></div>
          </div>
        </div>

        <!-- Active Worker Locks -->
        <div class="metric-card">
          <h3 class="metric-label">ACTIVE LOCKS</h3>
          <div class="metric-row">
            <span class="metric-value" [class.text-error]="workerStatus()?.activeLocks.length ?? 0 > 0">
              {{ workerStatus()?.activeLocks.length ?? 0 }}
            </span>
          </div>
          <div class="metric-bar">
            <div
              class="metric-bar-fill"
              [class.metric-bar-fill--primary]="(workerStatus()?.activeLocks.length ?? 0) === 0"
              [class.metric-bar-fill--warning]="(workerStatus()?.activeLocks.length ?? 0) > 0"
              [style.width]="workerLockBarWidth()"
            ></div>
          </div>
        </div>
      </div>

      <!-- Panels row -->
      <div class="panels-grid">
        <!-- Catalog Breakdown -->
        <div class="panel panel-wide">
          <div class="panel-header">
            <h3 class="panel-title">CATALOG_BREAKDOWN // By Category</h3>
          </div>
          <div class="panel-body">
            @if (catalogStats()?.productsByCategory.length) {
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="data-th">CATEGORY</th>
                    <th class="data-th data-th--right">COUNT</th>
                    <th class="data-th data-th--right">% OF TOTAL</th>
                    <th class="data-th data-th--wide">DISTRIBUTION</th>
                  </tr>
                </thead>
                <tbody>
                  @for (cat of catalogStats()!.productsByCategory; track cat.category) {
                    <tr class="data-tr">
                      <td class="data-td">{{ cat.category }}</td>
                      <td class="data-td data-td--mono data-td--right">{{ cat.count | number }}</td>
                      <td class="data-td data-td--mono data-td--right">{{ catPercent(cat.count) }}%</td>
                      <td class="data-td">
                        <div class="table-bar">
                          <div class="table-bar-fill" [style.width]="catPercent(cat.count) + '%'"></div>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div class="empty-table">
                <span class="material-symbols-outlined empty-icon">inventory_2</span>
                <p class="empty-text">No product categories yet</p>
              </div>
            }
          </div>
        </div>

        <!-- Quick Nav + Info -->
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">QUICK_NAV // Navigation</h3>
          </div>
          <div class="panel-body panel-nav-body">
            <a class="nav-card" routerLink="/admin/scrape-runs">
              <span class="material-symbols-outlined nav-card-icon">memory</span>
              <span class="nav-card-label">SCRAPE_RUNS</span>
              <span class="material-symbols-outlined nav-card-arrow">arrow_forward</span>
            </a>
            <a class="nav-card" routerLink="/admin/compatibility-quality">
              <span class="material-symbols-outlined nav-card-icon">query_stats</span>
              <span class="nav-card-label">COMPAT_QUALITY</span>
              <span class="material-symbols-outlined nav-card-arrow">arrow_forward</span>
            </a>
            <a class="nav-card" routerLink="/admin/reference-data">
              <span class="material-symbols-outlined nav-card-icon">database</span>
              <span class="nav-card-label">REFERENCE_DATA</span>
              <span class="material-symbols-outlined nav-card-arrow">arrow_forward</span>
            </a>

            <!-- Summary stats -->
            <div class="nav-divider"></div>
            <div class="info-row">
              <span class="info-label">TOTAL OFFERS</span>
              <span class="info-value">{{ dashboard()!.catalog.totalOffers | number }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">DISCOVERED</span>
              <span class="info-value">{{ dashboard()!.catalog.totalDiscovered | number }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">REF DATASETS</span>
              <span class="info-value">{{ dashboard()!.referenceDatasets.total }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">COMPAT PASS</span>
              <span class="info-value info-value--primary">{{ dashboard()!.compatibilityQuality.allGatesPassCount }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">COMPAT FAIL</span>
              <span class="info-value info-value--error">{{ dashboard()!.compatibilityQuality.allGatesFailCount }}</span>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }

    /* ── Metric Cards ──────────────────────────────────────────────── */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    @media (max-width: 1024px) {
      .metrics-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 600px) {
      .metrics-grid { grid-template-columns: 1fr; }
    }

    .metric-card {
      background: #1c1b1b;
      border: 1px solid #353534;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: border-color 0.15s;
    }
    .metric-card:hover {
      border-color: #353534;
    }

    .metric-label {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
    }

    .metric-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }

    .metric-value {
      font-family: var(--font-mono);
      font-size: 32px;
      font-weight: 400;
      line-height: 1;
      color: #e5e2e1;
    }
    .text-error { color: #ff4b4b; }

    .metric-bar {
      height: 4px;
      width: 100%;
      background: #353534;
      margin-top: 8px;
    }

    .metric-bar-fill {
      height: 100%;
      transition: width 0.6s ease;
    }
    .metric-bar-fill--primary { background: #caf300; }
    .metric-bar-fill--warning { background: #ffb300; }
    .metric-bar-fill--error { background: #ff4b4b; }

    /* ── Panels ────────────────────────────────────────────────────── */
    .panels-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
    }
    @media (max-width: 1024px) {
      .panels-grid { grid-template-columns: 1fr; }
    }

    .panel {
      background: #1c1b1b;
      border: 1px solid #353534;
      display: flex;
      flex-direction: column;
    }

    .panel-header {
      padding: 16px;
      border-bottom: 1px solid #353534;
    }

    .panel-title {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #e5e2e1;
    }

    .panel-body {
      flex: 1;
      padding: 0;
    }

    .panel-nav-body {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* ── Data Table ────────────────────────────────────────────────── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
    }

    .data-th {
      padding: 8px 16px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
      text-align: left;
      border-bottom: 1px solid #353534;
      background: #0e0e0e;
    }
    .data-th--right { text-align: right; }
    .data-th--wide { width: 40%; }

    .data-tr {
      border-bottom: 1px solid #2a2a29;
      transition: background 0.1s;
    }
    .data-tr:hover { background: #131313; }

    .data-td {
      padding: 12px 16px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #e5e2e1;
      letter-spacing: 0.02em;
    }
    .data-td--mono { font-variant-numeric: tabular-nums; }
    .data-td--right { text-align: right; }

    .table-bar {
      height: 8px;
      width: 100%;
      background: #353534;
    }
    .table-bar-fill {
      height: 100%;
      background: #caf300;
      transition: width 0.6s ease;
    }

    /* ── Empty table ───────────────────────────────────────────────── */
    .empty-table {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
    }
    .empty-icon {
      font-size: 48px;
      color: #555;
      margin-bottom: 16px;
    }
    .empty-text {
      font-family: var(--font-mono);
      font-size: 12px;
      color: #c8c6c5;
    }

    /* ── Nav cards ─────────────────────────────────────────────────── */
    .nav-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #0e0e0e;
      border: 1px solid #353534;
      text-decoration: none;
      transition: border-color 0.15s, background 0.15s;
      cursor: pointer;
    }
    .nav-card:hover {
      border-color: #caf300;
      background: #1c1b1b;
    }
    .nav-card:hover .nav-card-label { color: #caf300; }
    .nav-card:hover .nav-card-icon,
    .nav-card:hover .nav-card-arrow { color: #caf300; }

    .nav-card-icon {
      font-size: 20px;
      color: #c8c6c5;
      margin-right: 12px;
      transition: color 0.15s;
    }
    .nav-card-label {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #e5e2e1;
      flex: 1;
      transition: color 0.15s;
    }
    .nav-card-arrow {
      font-size: 18px;
      color: #c8c6c5;
      transition: color 0.15s;
    }

    .nav-divider {
      height: 1px;
      background: #353534;
      margin: 8px 0;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
    }
    .info-label {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
    }
    .info-value {
      font-family: var(--font-mono);
      font-size: 14px;
      color: #e5e2e1;
    }
    .info-value--primary { color: #caf300; }
    .info-value--error { color: #ff4b4b; }

    /* ── Loading skeleton ──────────────────────────────────────────── */
    .skeleton-label {
      height: 12px;
      width: 120px;
      background: #2a2a29;
      animation: pulse 1.5s infinite ease-in-out;
    }
    .skeleton-value {
      height: 32px;
      width: 80px;
      background: #2a2a29;
      animation: pulse 1.5s infinite ease-in-out;
    }
    .skeleton-bar {
      height: 4px;
      width: 100%;
      background: #2a2a29;
      animation: pulse 1.5s infinite ease-in-out;
    }
    .skeleton-table-row {
      height: 48px;
      background: #2a2a29;
      margin: 0 16px;
      animation: pulse 1.5s infinite ease-in-out;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }

    /* ── Error state ───────────────────────────────────────────────── */
    .error-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      text-align: center;
      border: 1px solid #ff4b4b;
      background: rgba(255, 75, 75, 0.05);
    }
    .error-icon {
      font-size: 48px;
      color: #ff4b4b;
      margin-bottom: 16px;
    }
    .error-title {
      font-family: var(--font-primary);
      font-size: 20px;
      font-weight: 600;
      color: #e5e2e1;
      margin-bottom: 8px;
    }
    .error-message {
      font-family: var(--font-mono);
      font-size: 12px;
      color: #c8c6c5;
      margin-bottom: 24px;
      max-width: 400px;
    }
    .retry-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: none;
      border: 1px solid #ff4b4b;
      color: #ff4b4b;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .retry-btn:hover {
      background: #ff4b4b;
      color: #000;
    }
  `,
})
export class AdminDashboardPage implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly dashState = signal<LoadState>('loading');
  readonly dashboard = signal<AdminDashboardResponse | null>(null);
  readonly workerStatus = signal<AdminWorkerStatusResponse | null>(null);
  readonly catalogStats = signal<AdminCatalogStatsResponse | null>(null);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.dashState.set('loading');
    this.errorMessage.set('');

    this.api.getDashboard().subscribe({
      next: (data) => {
        this.dashboard.set(data);
        this.dashState.set('loaded');
      },
      error: (err) => {
        this.errorMessage.set(
          err?.error?.error ?? `HTTP ${err.status}: Failed to load dashboard`,
        );
        this.dashState.set('error');
      },
    });

    // Load supplementary data (non-blocking)
    this.api.getWorkerStatus().subscribe({
      next: (data) => this.workerStatus.set(data),
      error: () => { /* non-blocking */ },
    });

    this.api.getCatalogStats().subscribe({
      next: (data) => this.catalogStats.set(data),
      error: () => { /* non-blocking */ },
    });
  }

  scrapeBarWidth(): string {
    const total = this.dashboard()?.scrapeRuns.total ?? 0;
    if (total === 0) return '0%';
    return Math.min(100, Math.max(5, total / 10)) + '%';
  }

  compatPassRatio(): number {
    const d = this.dashboard();
    if (!d) return 0;
    const total = d.compatibilityQuality.allGatesPassCount + d.compatibilityQuality.allGatesFailCount;
    if (total === 0) return 1;
    return d.compatibilityQuality.allGatesPassCount / total;
  }

  compatBarWidth(): string {
    return Math.round(this.compatPassRatio() * 100) + '%';
  }

  workerLockBarWidth(): string {
    const locks = this.workerStatus()?.activeLocks.length ?? 0;
    if (locks === 0) return '5%';
    return Math.min(100, locks * 25) + '%';
  }

  catPercent(count: number): number {
    const total = this.catalogStats()?.totalProducts ?? 1;
    return Math.round((count / total) * 100);
  }
}
