import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/services/admin-api.service';
import type {
  AdminDashboardResponse,
  AdminWorkerStatusResponse,
  AdminCatalogStatsResponse,
  AdminScrapeRunListItem,
} from '@buildsense/contracts';

type LoadState = 'loading' | 'loaded' | 'error';

interface ChartBar {
  category: string;
  count: number;
  heightPercent: number;
}

interface ActivityRow {
  id: string;
  status: string;
  statusClass: string;
  timestamp: string;
  source: string;
  event: string;
  actionLabel: string;
  actionRoute: string;
}

interface EligibilityItem {
  label: string;
  count: number;
}

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
          </div>
        }
      </div>
      <div class="panels-grid">
        <div class="panel">
          <div class="panel-header"><div class="skeleton-label" style="width:200px"></div></div>
          <div class="panel-body">
            <div class="skeleton-chart"></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><div class="skeleton-label" style="width:140px"></div></div>
          <div class="panel-body">
            <div class="skeleton-table-row" *ngFor="let r of [1,2,3]"></div>
          </div>
        </div>
      </div>
      <div class="panel" style="margin-bottom: 16px;">
        <div class="panel-header"><div class="skeleton-label" style="width:180px"></div></div>
        <div class="panel-body">
          <div class="skeleton-table-row" *ngFor="let r of [1,2,3,4,5]"></div>
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
      <!-- Metric cards — 4 across matching Stitch -->
      <div class="metrics-grid">
        <!-- Recent Scrape Runs -->
        <div class="metric-card" routerLink="/admin/scrape-runs">
          <h3 class="metric-label">RECENT SCRAPE RUNS</h3>
          <div class="metric-value">{{ dashboard()!.scrapeRuns.total | number }}</div>
        </div>

        <!-- Failed Runs -->
        <div class="metric-card" [class.metric-card--error]="failedRunCount() > 0" routerLink="/admin/scrape-runs">
          <h3 class="metric-label">FAILED — RECENT RUNS</h3>
          <div class="metric-value" [class.metric-value--error]="failedRunCount() > 0">{{ failedRunCount() }}</div>
        </div>

        <!-- Open Match Reviews -->
        <div class="metric-card" [class.metric-card--warning]="openMatchReviews() > 0" routerLink="/admin/match-reviews">
          <h3 class="metric-label">OPEN MATCH REVIEWS</h3>
          <div class="metric-value" [class.metric-value--warning]="openMatchReviews() > 0">{{ openMatchReviews() }}</div>
          <div class="metric-status-row">
            @if (openMatchReviews() > 0) {
              <span class="material-symbols-outlined metric-status-icon metric-status-icon--warning">rule</span>
              <span class="metric-status-text metric-status-text--warning">Needs Review</span>
            } @else {
              <span class="metric-status-text metric-status-text--ok">Clear</span>
            }
          </div>
        </div>

        <!-- Open Data Issues -->
        <div class="metric-card metric-card--alert" routerLink="/admin/data-quality">
          <h3 class="metric-label">UNRESOLVED DATA ISSUES</h3>
          <div class="metric-value" [class.metric-value--error]="openDataQualityIssues() > 0">{{ openDataQualityIssues() }}</div>
        </div>
      </div>

      <!-- Two-panel: Chart + Eligibility Summary -->
      <div class="panels-grid">
        <!-- Catalog Chart -->
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">CATALOG_DISTRIBUTION // Products by Category</h3>
          </div>
          <div class="panel-body chart-body">
            @if (chartBars().length) {
              <div class="chart-container" role="img" [attr.aria-label]="chartAriaLabel()">
                <div class="chart-y-axis">
                  <span class="chart-y-label">{{ chartMaxValue() | number }}</span>
                  <span class="chart-y-label">{{ (chartMaxValue() / 2) | number }}</span>
                  <span class="chart-y-label">0</span>
                </div>
                <div class="chart-area">
                  <div class="chart-gridlines">
                    <div class="chart-gridline"></div>
                    <div class="chart-gridline"></div>
                    <div class="chart-gridline chart-gridline--bottom"></div>
                  </div>
                  <div class="chart-bars">
                    @for (bar of chartBars(); track bar.category) {
                      <div class="chart-bar-group">
                        <div class="chart-bar-wrapper">
                          <div
                            class="chart-bar"
                            [style.height.%]="bar.heightPercent"
                            [attr.aria-label]="bar.category + ': ' + (bar.count | number) + ' products'"
                          ></div>
                        </div>
                        <span class="chart-bar-label">{{ bar.category }}</span>
                        <span class="chart-bar-value">{{ bar.count | number }}</span>
                      </div>
                    }
                  </div>
                </div>
              </div>
            } @else {
              <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">bar_chart</span>
                <p class="empty-text">No category data available</p>
              </div>
            }
          </div>
        </div>

        <!-- Eligibility Summary -->
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">ELIGIBILITY_SUMMARY // Product Eligibility Counts</h3>
          </div>
          <div class="panel-body eligibility-body">
            @if (eligibilityData().length) {
              <div class="eligibility-items">
                @for (item of eligibilityData(); track item.label) {
                  <div class="eligibility-item">
                    <span class="eligibility-label">{{ item.label }}</span>
                    <span class="eligibility-count">{{ item.count | number }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">analytics</span>
                <p class="empty-text">No eligibility data</p>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Recent Activity Table -->
      <div class="panel activity-panel">
        <div class="panel-header activity-header">
          <h3 class="panel-title">RECENT_ACTIVITY // EVENT_LOG</h3>
          <a class="panel-action" routerLink="/admin/scrape-runs">VIEW_ALL</a>
        </div>
        <div class="panel-body activity-body">
          @if (activityLoading()) {
            <div class="activity-skeleton">
              @for (r of [1,2,3,4,5]; track r) {
                <div class="skeleton-table-row"></div>
              }
            </div>
          } @else if (activityError()) {
            <div class="activity-error">
              <span class="material-symbols-outlined activity-error-icon">cloud_off</span>
              <span class="activity-error-text">Unable to load recent activity</span>
            </div>
          } @else if (activityRows().length) {
            <div class="table-scroll-container">
              <table class="activity-table" aria-label="Recent scrape run activity">
                <thead>
                  <tr>
                    <th class="activity-th activity-th--status">STATUS</th>
                    <th class="activity-th">TIMESTAMP</th>
                    <th class="activity-th">SOURCE</th>
                    <th class="activity-th">EVENT</th>
                    <th class="activity-th activity-th--action">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of activityRows(); track row.id) {
                    <tr class="activity-tr">
                      <td class="activity-td activity-td--status">
                        <span class="status-badge" [class]="row.statusClass">{{ row.status }}</span>
                      </td>
                      <td class="activity-td activity-td--timestamp">
                        <time [attr.datetime]="row.timestamp">{{ formatTimestamp(row.timestamp) }}</time>
                      </td>
                      <td class="activity-td activity-td--source">{{ row.source }}</td>
                      <td class="activity-td activity-td--event">{{ row.event }}</td>
                      <td class="activity-td activity-td--action">
                        <a class="action-link" [routerLink]="row.actionRoute">{{ row.actionLabel }}</a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="empty-state">
              <span class="material-symbols-outlined empty-icon">inbox</span>
              <p class="empty-text">No recent activity</p>
            </div>
          }
        </div>
      </div>

      <!-- Bottom navigation cards -->
      <div class="nav-cards-row">
        <a class="nav-card" routerLink="/admin/scrape-runs">
          <span class="material-symbols-outlined nav-card-icon">memory</span>
          <span class="nav-card-label">SCRAPE_RUNS</span>
          <span class="material-symbols-outlined nav-card-arrow">arrow_forward</span>
        </a>
        <a class="nav-card" routerLink="/admin/match-reviews">
          <span class="material-symbols-outlined nav-card-icon">rule</span>
          <span class="nav-card-label">MATCH_REVIEWS</span>
          <span class="material-symbols-outlined nav-card-arrow">arrow_forward</span>
        </a>
        <a class="nav-card" routerLink="/admin/data-quality">
          <span class="material-symbols-outlined nav-card-icon">query_stats</span>
          <span class="nav-card-label">DATA_QUALITY</span>
          <span class="material-symbols-outlined nav-card-arrow">arrow_forward</span>
        </a>
      </div>
    }
  `,
  styles: `
    :host { display: block; }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 16px;
    }
    @media (max-width: 1200px) {
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
      cursor: default;
      transition: border-color 0.15s;
      position: relative;
      overflow: hidden;
    }
    .metric-card[routerLink] {
      cursor: pointer;
    }
    .metric-card:hover {
      border-color: #444932;
    }
    .metric-card--error:hover {
      border-color: #ff4b4b;
    }
    .metric-card--warning:hover {
      border-color: #ffb300;
    }
    .metric-card--alert {
      border-color: rgba(255, 75, 75, 0.5);
    }
    .metric-card--alert::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(45deg, #ff4b4b 0, #ff4b4b 1px, transparent 1px, transparent 10px);
      opacity: 0.1;
      pointer-events: none;
    }

    .metric-label {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8f9378;
      line-height: 1.2;
    }

    .metric-value {
      font-family: var(--font-mono);
      font-size: 32px;
      font-weight: 400;
      line-height: 1;
      color: #e5e2e1;
      font-variant-numeric: tabular-nums;
    }
    .metric-value--warning { color: #ffb300; }
    .metric-value--error { color: #ff4b4b; }

    .metric-status-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
    }
    .metric-status-icon {
      font-size: 16px;
    }
    .metric-status-icon--warning { color: #ffb300; }
    .metric-status-text {
      font-family: var(--font-mono);
      font-size: 12px;
      letter-spacing: 0.02em;
    }
    .metric-status-text--ok { color: #caf300; }
    .metric-status-text--warning { color: #ffb300; }

    .panels-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
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
      padding: 12px 16px;
      border-bottom: 1px solid #353534;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-title {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #8f9378;
      line-height: 1.4;
    }

    .panel-action {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8f9378;
      text-decoration: none;
      cursor: pointer;
      transition: color 0.15s;
    }
    .panel-action:hover {
      color: #caf300;
    }

    .panel-body {
      flex: 1;
      padding: 0;
      overflow-x: auto;
    }

    .chart-body {
      padding: 24px;
      min-height: 280px;
    }
    @media (max-width: 768px) {
      .chart-body { padding: 16px; min-height: 200px; }
    }

    .chart-container {
      display: flex;
      gap: 12px;
      height: 220px;
    }
    @media (max-width: 768px) {
      .chart-container { height: 160px; }
    }

    .chart-y-axis {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding-bottom: 24px;
    }
    .chart-y-label {
      font-family: var(--font-mono);
      font-size: 10px;
      color: #8f9378;
      text-align: right;
      min-width: 40px;
    }

    .chart-area {
      flex: 1;
      position: relative;
    }

    .chart-gridlines {
      position: absolute;
      inset: 0;
      bottom: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      pointer-events: none;
    }
    .chart-gridline {
      height: 1px;
      background: #353534;
    }
    .chart-gridline--bottom {
      background: #444932;
    }

    .chart-bars {
      position: absolute;
      inset: 0;
      bottom: 24px;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 0 4px;
    }

    .chart-bar-group {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 0;
    }

    .chart-bar-wrapper {
      width: 100%;
      height: 180px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    @media (max-width: 768px) {
      .chart-bar-wrapper { height: 120px; }
    }

    .chart-bar {
      width: 100%;
      max-width: 48px;
      background: #caf300;
      transition: height 0.6s ease;
      min-height: 2px;
    }
    .chart-bar:hover {
      background: #b0d500;
    }

    .chart-bar-label {
      font-family: var(--font-mono);
      font-size: 9px;
      color: #8f9378;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 8px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .chart-bar-value {
      font-family: var(--font-mono);
      font-size: 10px;
      color: #e5e2e1;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .eligibility-body {
      padding: 24px;
    }
    .eligibility-items {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .eligibility-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .eligibility-label {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #8f9378;
    }
    .eligibility-count {
      font-family: var(--font-mono);
      font-size: 14px;
      color: #e5e2e1;
      font-variant-numeric: tabular-nums;
    }

    .activity-panel {
      margin-bottom: 16px;
    }
    .activity-body {
      min-height: 100px;
    }

    .table-scroll-container {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .activity-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 640px;
    }

    .activity-th {
      padding: 8px 16px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #8f9378;
      text-align: left;
      border-bottom: 1px solid #353534;
      background: #131313;
      white-space: nowrap;
    }
    .activity-th--status { width: 120px; }
    .activity-th--action { text-align: right; }

    .activity-tr {
      border-bottom: 1px solid #2a2a2a;
      transition: background 0.1s;
    }
    .activity-tr:hover { background: #131313; }

    .activity-td {
      padding: 12px 16px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #e5e2e1;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .activity-td--status { width: 120px; }
    .activity-td--timestamp { color: #c8c6c5; }
    .activity-td--event { color: #c8c6c5; max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
    .activity-td--action { text-align: right; }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid;
    }
    .status-badge--completed {
      color: #caf300;
      border-color: #caf300;
      background: rgba(202, 243, 0, 0.1);
    }
    .status-badge--failed {
      color: #ff4b4b;
      border-color: #ff4b4b;
      background: rgba(255, 75, 75, 0.1);
    }
    .status-badge--running {
      color: #a0a0a0;
      border-color: #a0a0a0;
      background: rgba(160, 160, 160, 0.1);
    }
    .status-badge--pending {
      color: #ffb300;
      border-color: #ffb300;
      background: rgba(255, 179, 0, 0.1);
    }

    .action-link {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8f9378;
      text-decoration: none;
      cursor: pointer;
      transition: color 0.15s;
    }
    .action-link:hover {
      color: #caf300;
    }

    .activity-skeleton {
      padding: 8px 0;
    }

    .activity-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 24px 16px;
      color: #8f9378;
    }
    .activity-error-icon {
      font-size: 20px;
    }
    .activity-error-text {
      font-family: var(--font-mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
    }
    .empty-icon {
      font-size: 40px;
      color: #353534;
      margin-bottom: 12px;
    }
    .empty-text {
      font-family: var(--font-mono);
      font-size: 11px;
      color: #8f9378;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .nav-cards-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 768px) {
      .nav-cards-row { grid-template-columns: 1fr; }
    }

    .nav-card {
      display: flex;
      align-items: center;
      padding: 16px 20px;
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
      color: #8f9378;
      margin-right: 16px;
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
      color: #8f9378;
      transition: color 0.15s;
    }

    .skeleton-label {
      height: 10px;
      width: 120px;
      background: #2a2a2a;
      animation: pulse 1.5s infinite ease-in-out;
    }
    .skeleton-value {
      height: 32px;
      width: 80px;
      background: #2a2a2a;
      animation: pulse 1.5s infinite ease-in-out;
    }
    .skeleton-chart {
      height: 220px;
      margin: 24px;
      background: #2a2a2a;
      animation: pulse 1.5s infinite ease-in-out;
    }
    .skeleton-table-row {
      height: 44px;
      background: #2a2a2a;
      margin: 0 16px;
      animation: pulse 1.5s infinite ease-in-out;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }

    .error-panel {
      justify-content: center;
    }
    .error-title {
      font-family: var(--font-primary);
      font-size: 20px;
      font-weight: 600;
      color: #e5e2e1;
      margin-bottom: 8px;
    }
    .retry-btn {
      transition: background 0.15s, color 0.15s;
    }
  `,
})
export class AdminDashboardPage implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly dashState = signal<LoadState>('loading');
  readonly dashboard = signal<AdminDashboardResponse | null>(null);
  readonly workerStatus = signal<AdminWorkerStatusResponse | null>(null);
  readonly catalogStats = signal<AdminCatalogStatsResponse | null>(null);
  readonly openMatchReviews = signal(0);
  readonly openDataQualityIssues = signal(0);
  readonly errorMessage = signal('');
  readonly recentScrapeRuns = signal<AdminScrapeRunListItem[]>([]);
  readonly activityLoading = signal(false);
  readonly activityError = signal(false);

  readonly chartBars = computed<ChartBar[]>(() => {
    const stats = this.catalogStats();
    if (!stats?.productsByCategory.length) return [];
    const maxCount = Math.max(...stats.productsByCategory.map((c) => c.count));
    return stats.productsByCategory.map((cat) => ({
      category: cat.category,
      count: cat.count,
      heightPercent: maxCount > 0 ? (cat.count / maxCount) * 100 : 0,
    }));
  });

  readonly chartMaxValue = computed(() => {
    const bars = this.chartBars();
    if (!bars.length) return 0;
    return Math.max(...bars.map((b) => b.count));
  });

  readonly chartAriaLabel = computed(() => {
    const bars = this.chartBars();
    if (!bars.length) return 'No category data';
    return `Bar chart showing products by category: ${bars.map((b) => `${b.category} ${b.count}`).join(', ')}`;
  });

  readonly failedRunCount = computed(() => {
    return this.recentScrapeRuns().filter((r) => r.status === 'FAILED').length;
  });

  readonly eligibilityData = computed<EligibilityItem[]>(() => {
    const stats = this.catalogStats();
    if (!stats?.productsByEligibility) return [];
    return [
      { label: 'ELIGIBLE', count: stats.productsByEligibility.eligible },
      { label: 'NOT ELIGIBLE', count: stats.productsByEligibility.notEligible },
    ];
  });

  readonly activityRows = computed<ActivityRow[]>(() => {
    return this.recentScrapeRuns().map((run) => this.mapScrapeRunToActivityRow(run));
  });

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

    // Supplementary data — non-blocking, best-effort
    this.api.getWorkerStatus().subscribe({
      next: (data) => this.workerStatus.set(data),
      error: () => { /* non-blocking */ },
    });

    this.api.getCatalogStats().subscribe({
      next: (data) => this.catalogStats.set(data),
      error: () => { /* non-blocking */ },
    });

    this.api.getMatchReviews({ status: 'PENDING', pageSize: '1' }).subscribe({
      next: (data) => this.openMatchReviews.set(data.pagination.totalItems),
      error: () => { /* non-blocking */ },
    });

    this.api.getDataQualityIssues({ status: 'OPEN', pageSize: '1' }).subscribe({
      next: (data) => this.openDataQualityIssues.set(data.pagination.totalItems),
      error: () => { /* non-blocking */ },
    });

    // Load recent scrape runs for activity table
    this.activityLoading.set(true);
    this.activityError.set(false);
    this.api.getScrapeRuns({ pageSize: '8' }).subscribe({
      next: (data) => {
        this.recentScrapeRuns.set(data.items);
        this.activityLoading.set(false);
      },
      error: () => {
        this.activityError.set(true);
        this.activityLoading.set(false);
      },
    });
  }

  compatPassCount(): number {
    return this.dashboard()?.compatibilityQuality.allGatesPassCount ?? 0;
  }

  activeLockCount(): number {
    return this.workerStatus()?.activeLocks.length ?? this.dashboard()?.worker.activeLocks ?? 0;
  }

  formatTimestamp(iso: string): string {
    try {
      const date = new Date(iso);
      return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
    } catch {
      return iso;
    }
  }

  private mapScrapeRunToActivityRow(run: AdminScrapeRunListItem): ActivityRow {
    const status = this.normalizeStatus(run.status);
    const statusClass = this.getStatusClass(status);
    const event = this.buildEventText(run);
    const action = this.getActionForStatus(status);

    return {
      id: run.id,
      status,
      statusClass,
      timestamp: run.startedAt ?? run.createdAt,
      source: run.storeCode,
      event,
      actionLabel: action.label,
      actionRoute: `/admin/scrape-runs/${encodeURIComponent(run.runId)}`,
    };
  }

  private normalizeStatus(status: string): string {
    const upper = status.toUpperCase();
    if (upper === 'COMPLETED' || upper === 'DONE') return 'COMPLETED';
    if (upper === 'FAILED' || upper === 'ERROR') return 'FAILED';
    if (upper === 'RUNNING' || upper === 'IN_PROGRESS') return 'RUNNING';
    if (upper === 'PENDING' || upper === 'QUEUED') return 'PENDING';
    return upper;
  }

  private getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'status-badge status-badge--completed';
      case 'FAILED': return 'status-badge status-badge--failed';
      case 'RUNNING': return 'status-badge status-badge--running';
      case 'PENDING': return 'status-badge status-badge--pending';
      default: return 'status-badge';
    }
  }

  private buildEventText(run: AdminScrapeRunListItem): string {
    if (run.summary) {
      const { totalDiscovered, totalFetched, totalFailed } = run.summary;
      if (totalFailed > 0) {
        return `${totalFetched} fetched, ${totalFailed} failed of ${totalDiscovered} discovered`;
      }
      return `${totalFetched} items fetched of ${totalDiscovered} discovered`;
    }
    return run.mode ? `Mode: ${run.mode}` : 'No summary available';
  }

  private getActionForStatus(status: string): { label: string } {
    switch (status) {
      case 'COMPLETED': return { label: 'VIEW_LOG' };
      case 'FAILED': return { label: 'VIEW_LOG' };
      case 'RUNNING': return { label: 'STATUS' };
      case 'PENDING': return { label: 'STATUS' };
      default: return { label: 'VIEW' };
    }
  }
}
