import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/services/admin-api.service';
import type { AdminScrapeRunDetailResponse } from '@buildsense/contracts';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-admin-scrape-run-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <!-- Back link -->
    <a class="back-link" routerLink="/admin/scrape-runs">
      <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
      SCRAPE RUNS
    </a>

    <!-- Loading skeleton -->
    @if (state() === 'loading') {
      <div class="detail-panels">
        <div class="detail-panel">
          <div class="skeleton-label" style="width:120px"></div>
          <div class="skeleton-value" style="width:200px"></div>
          <div class="skeleton-label" style="width:80px; margin-top:16px"></div>
          <div class="skeleton-value" style="width:140px"></div>
        </div>
        <div class="detail-panel">
          <div class="skeleton-label" style="width:160px"></div>
          <div class="skeleton-row" *ngFor="let r of [1,2,3]" style="height:40px; margin-top:8px"></div>
        </div>
      </div>
    }

    <!-- Error state -->
    @if (state() === 'error') {
      <div class="error-panel">
        <span class="material-symbols-outlined error-icon">bolt</span>
        <h3 class="error-title">Failed to load scrape run</h3>
        <p class="error-message">{{ errorMessage() }}</p>
        <button class="retry-btn" (click)="load()">
          <span class="material-symbols-outlined" style="font-size:16px;">refresh</span>
          RETRY
        </button>
      </div>
    }

    <!-- Detail panels -->
    @if (state() === 'loaded' && run()) {
      <!-- Summary strip -->
      <div class="summary-strip">
        <div class="summary-item">
          <span class="summary-label">STATUS</span>
          <span class="status-badge" [class]="'status-badge--' + run()!.status.toLowerCase()">
            <span class="status-dot"></span>
            {{ run()!.status }}
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">RUN ID</span>
          <span class="summary-value">{{ run()!.runId }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">STORE</span>
          <span class="summary-value">{{ run()!.storeCode }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">MODE</span>
          <span class="summary-value">{{ run()!.mode }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">STAGE</span>
          <span class="summary-value">{{ run()!.stage }}</span>
        </div>
      </div>

      <div class="detail-panels">
        <!-- Info panel -->
        <div class="detail-panel">
          <div class="panel-header">
            <h3 class="panel-title">RUN_INFO // Execution Details</h3>
          </div>
          <div class="panel-body">
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">STARTED</span>
                <span class="info-value">{{ formatDate(run()!.startedAt) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">COMPLETED</span>
                <span class="info-value">{{ formatDate(run()!.completedAt) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">CREATED</span>
                <span class="info-value">{{ formatDate(run()!.createdAt) }}</span>
              </div>
              <div class="info-row-divider"></div>
              <div class="info-row">
                <span class="info-label">DISCOVERED</span>
                <span class="info-value">{{ run()!.summary?.totalDiscovered ?? '—' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">FETCHED</span>
                <span class="info-value">{{ run()!.summary?.totalFetched ?? '—' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">FAILED</span>
                <span class="info-value" [class.text-error]="(run()!.summary?.totalFailed ?? 0) > 0">
                  {{ run()!.summary?.totalFailed ?? '—' }}
                </span>
              </div>
              @if (run()!.summary?.totalMissingPrice != null) {
                <div class="info-row">
                  <span class="info-label">MISSING PRICE</span>
                  <span class="info-value" [class.text-warning]="run()!.summary!.totalMissingPrice! > 0">
                    {{ run()!.summary!.totalMissingPrice }}
                  </span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Category audit panel -->
        <div class="detail-panel">
          <div class="panel-header">
            <h3 class="panel-title">CATEGORY_AUDIT // Per-Seed Breakdown</h3>
          </div>
          <div class="panel-body">
            @if (run()!.categoryAudit && run()!.categoryAudit!.length > 0) {
              <div class="table-wrapper">
                <table class="data-table">
                <thead>
                  <tr>
                    <th class="data-th">SEED ID</th>
                    <th class="data-th data-th--right">PAGES</th>
                    <th class="data-th data-th--right">PRODUCTS</th>
                    <th class="data-th">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  @for (cat of run()!.categoryAudit!; track cat.seedId) {
                    <tr class="data-tr">
                      <td class="data-td">{{ cat.seedId }}</td>
                      <td class="data-td data-td--mono data-td--right">{{ cat.pagesProcessed }}</td>
                      <td class="data-td data-td--mono data-td--right">{{ cat.productsDiscovered }}</td>
                      <td class="data-td">
                        @if (cat.completed) {
                          <span class="mini-badge mini-badge--ok">DONE</span>
                        } @else {
                          <span class="mini-badge mini-badge--fail">
                            {{ cat.failureKind ?? 'INCOMPLETE' }}
                          </span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              </div>
            } @else {
              <div class="empty-table">
                <span class="material-symbols-outlined" style="font-size:32px;color:#555;">list</span>
                <p class="empty-text">No category audit data</p>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Failures panel -->
      @if (run()!.failures && run()!.failures.length > 0) {
        <div class="detail-panel" style="margin-top:16px;">
          <div class="panel-header">
            <h3 class="panel-title">FAILURES // {{ run()!.failures.length }} item(s)</h3>
          </div>
          <div class="panel-body">
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="data-th">URL</th>
                    <th class="data-th">FETCH STATE</th>
                    <th class="data-th">FAILURE KIND</th>
                    <th class="data-th data-th--right">ATTEMPTS</th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of run()!.failures; track f.canonicalUrl) {
                    <tr class="data-tr">
                      <td class="data-td data-td--url">{{ truncateUrl(f.canonicalUrl) }}</td>
                      <td class="data-td">{{ f.fetchState }}</td>
                      <td class="data-td">
                        <span class="mini-badge mini-badge--fail">{{ f.failureKind ?? '—' }}</span>
                      </td>
                      <td class="data-td data-td--mono data-td--right">{{ f.attempts }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
      text-decoration: none;
      margin-bottom: 16px;
      transition: color 0.15s;
    }
    .back-link:hover { color: #caf300; }

    .summary-strip {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      padding: 16px;
      background: #1c1b1b;
      border: 1px solid #353534;
      margin-bottom: 16px;
    }
    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .summary-label {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
    }
    .summary-value {
      font-family: var(--font-mono);
      font-size: 14px;
      color: #e5e2e1;
    }

    .detail-panels {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 16px;
      overflow: hidden;
    }
    @media (max-width: 1024px) {
      .detail-panels { grid-template-columns: 1fr; }
    }

    .detail-panel {
      background: #1c1b1b;
      border: 1px solid #353534;
      min-width: 0;
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

    .panel-body { padding: 0; }

    .info-grid { padding: 16px; }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #2a2a29;
    }
    .info-row:last-child { border-bottom: none; }
    .info-row-divider {
      height: 1px;
      background: #353534;
      margin: 8px 0;
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
      font-size: 12px;
      color: #e5e2e1;
    }
    .text-error { color: #ff4b4b; }
    .text-warning { color: #ffb300; }

    /* ── Status badge ──────────────────────────────────────────────── */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid;
    }
    .status-dot { width: 6px; height: 6px; }
    .status-badge--created { border-color: #4fc3f7; background: rgba(79,195,247,0.1); color: #4fc3f7; }
    .status-badge--created .status-dot { background: #4fc3f7; }
    .status-badge--failed { border-color: #ff4b4b; background: rgba(255,75,75,0.1); color: #ff4b4b; }
    .status-badge--failed .status-dot { background: #ff4b4b; }
    .status-badge--running { border-color: #c8c6c5; background: rgba(200,198,197,0.1); color: #c8c6c5; }
    .status-badge--running .status-dot { background: #c8c6c5; }
    .status-badge--cancelled { border-color: #555; background: rgba(85,85,85,0.1); color: #888; }
    .status-badge--cancelled .status-dot { background: #888; }
    .status-badge--partially_failed { border-color: #ff8a00; background: rgba(255,138,0,0.1); color: #ff8a00; }
    .status-badge--partially_failed .status-dot { background: #ff8a00; }
    .status-badge--succeeded { border-color: #caf300; background: rgba(202,243,0,0.1); color: #caf300; }
    .status-badge--succeeded .status-dot { background: #caf300; }

    /* ── Mini badge ────────────────────────────────────────────────── */
    .mini-badge {
      display: inline-block;
      padding: 2px 6px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid;
    }
    .mini-badge--ok { border-color: #caf300; color: #caf300; background: rgba(202,243,0,0.1); }
    .mini-badge--fail { border-color: #ff4b4b; color: #ff4b4b; background: rgba(255,75,75,0.1); }

    /* ── Data table ────────────────────────────────────────────────── */
    .table-wrapper { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; min-width: 600px; }
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
    .data-tr { border-bottom: 1px solid #2a2a29; transition: background 0.1s; }
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
    .data-td--url { max-width: 300px; overflow: hidden; text-overflow: ellipsis; }

    .empty-table {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      gap: 8px;
    }
    .empty-text { font-family: var(--font-mono); font-size: 12px; color: #555; }

    /* ── Loading / Error ───────────────────────────────────────────── */
    .skeleton-label { height: 12px; background: #2a2a29; animation: pulse 1.5s infinite ease-in-out; }
    .skeleton-value { height: 24px; background: #2a2a29; margin-top: 8px; animation: pulse 1.5s infinite ease-in-out; }
    .skeleton-row { background: #2a2a29; animation: pulse 1.5s infinite ease-in-out; }
    @keyframes pulse { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }

    .error-panel {
      display: flex; flex-direction: column; align-items: center;
      padding: 64px 24px; text-align: center;
      border: 1px solid #ff4b4b; background: rgba(255,75,75,0.05);
    }
    .error-icon { font-size: 48px; color: #ff4b4b; margin-bottom: 16px; }
    .error-title { font-family: var(--font-primary); font-size: 20px; font-weight: 600; color: #e5e2e1; margin-bottom: 8px; }
    .error-message { font-family: var(--font-mono); font-size: 12px; color: #c8c6c5; margin-bottom: 24px; max-width: 400px; }
    .retry-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px; background: none; border: 1px solid #ff4b4b; color: #ff4b4b;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .retry-btn:hover { background: #ff4b4b; color: #000; }
  `,
})
export class AdminScrapeRunDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AdminApiService);

  readonly state = signal<LoadState>('loading');
  readonly run = signal<AdminScrapeRunDetailResponse | null>(null);
  readonly errorMessage = signal('');

  private runId = '';

  ngOnInit(): void {
    this.runId = this.route.snapshot.paramMap.get('runId') ?? '';
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');

    this.api.getScrapeRun(this.runId).subscribe({
      next: (data) => {
        this.run.set(data);
        this.state.set('loaded');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? `HTTP ${err.status}`);
        this.state.set('error');
      },
    });
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${da} ${h}:${mi}:${s}`;
  }

  truncateUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.pathname.length > 60 ? u.pathname.slice(0, 57) + '...' : u.pathname;
    } catch {
      return url.length > 60 ? url.slice(0, 57) + '...' : url;
    }
  }
}
