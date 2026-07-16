import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../core/services/admin-api.service';
import type { AdminCompatibilityQualityItem } from '@buildsense/contracts';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-admin-compatibility',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Loading skeleton -->
    @if (state() === 'loading') {
      <div class="skeleton-panel">
        <div class="skeleton-row" *ngFor="let r of [1,2,3]"></div>
      </div>
    }

    <!-- Error state -->
    @if (state() === 'error') {
      <div class="error-panel">
        <span class="material-symbols-outlined error-icon">bolt</span>
        <h3 class="error-title">Failed to load compatibility quality</h3>
        <p class="error-message">{{ errorMessage() }}</p>
        <button class="retry-btn" (click)="load()">
          <span class="material-symbols-outlined" style="font-size:16px;">refresh</span>
          RETRY
        </button>
      </div>
    }

    <!-- Empty state -->
    @if (state() === 'loaded' && items().length === 0) {
      <div class="empty-panel">
        <span class="material-symbols-outlined empty-icon">analytics</span>
        <h3 class="empty-title">No compatibility data</h3>
        <p class="empty-message">Run the compatibility engine to populate quality metrics per category.</p>
      </div>
    }

    <!-- Data loaded -->
    @if (state() === 'loaded' && items().length > 0) {
      <div class="quality-cards">
        @for (item of items(); track item.category) {
          <div class="quality-card" [class.quality-card--fail]="!item.allGatesPass">
            <div class="card-header">
              <h3 class="card-category">{{ item.category }}</h3>
              @if (item.allGatesPass) {
                <span class="gate-badge gate-badge--pass">ALL GATES PASS</span>
              } @else {
                <span class="gate-badge gate-badge--fail">GATES FAIL</span>
              }
            </div>

            <div class="card-meta">
              <div class="meta-item">
                <span class="meta-label">EXTRACTOR</span>
                <span class="meta-value">{{ item.extractorVersion }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">PRODUCTS</span>
                <span class="meta-value">{{ item.totalProducts | number }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">EVALUATED</span>
                <span class="meta-value">{{ formatDate(item.evaluatedAt) }}</span>
              </div>
            </div>

            <!-- Fact metrics table -->
            @if (item.factMetrics.length > 0) {
              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th class="data-th">FACT KEY</th>
                      <th class="data-th data-th--right">EXTRACTABLE</th>
                      <th class="data-th data-th--right">COVERAGE</th>
                      <th class="data-th data-th--right">PRECISION</th>
                      <th class="data-th">VERIFIED</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (fm of item.factMetrics; track fm.factKey) {
                      <tr class="data-tr">
                        <td class="data-td">{{ fm.factKey }}</td>
                        <td class="data-td data-td--mono data-td--right">{{ fm.extractableCount | number }}</td>
                        <td class="data-td data-td--mono data-td--right">
                          <span [class.text-primary]="fm.coverage >= 0.8"
                                [class.text-warning]="fm.coverage < 0.8 && fm.coverage >= 0.5"
                                [class.text-error]="fm.coverage < 0.5">
                            {{ (fm.coverage * 100).toFixed(1) }}%
                          </span>
                        </td>
                        <td class="data-td data-td--mono data-td--right">
                          @if (fm.precision != null) {
                            <span [class.text-primary]="fm.precision >= 0.9"
                                  [class.text-warning]="fm.precision < 0.9 && fm.precision >= 0.7"
                                  [class.text-error]="fm.precision < 0.7">
                              {{ (fm.precision * 100).toFixed(1) }}%
                            </span>
                          } @else {
                            <span class="text-dim">—</span>
                          }
                        </td>
                        <td class="data-td">
                          @if (fm.verifiedCorrect != null && fm.verifiedSampleSize != null) {
                            <span class="text-dim">
                              {{ fm.verifiedCorrect }}/{{ fm.verifiedSampleSize }}
                            </span>
                          } @else {
                            <span class="text-dim">—</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }

    .quality-cards {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .quality-card {
      background: #1c1b1b;
      border: 1px solid #353534;
    }
    .quality-card--fail {
      border-color: #ff4b4b;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid #353534;
    }

    .card-category {
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #e5e2e1;
    }

    .gate-badge {
      padding: 4px 8px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid;
    }
    .gate-badge--pass { border-color: #caf300; color: #caf300; background: rgba(202,243,0,0.1); }
    .gate-badge--fail { border-color: #ff4b4b; color: #ff4b4b; background: rgba(255,75,75,0.1); }

    .card-meta {
      display: flex;
      gap: 24px;
      padding: 12px 16px;
      border-bottom: 1px solid #2a2a29;
      flex-wrap: wrap;
    }
    .meta-item { display: flex; flex-direction: column; gap: 2px; }
    .meta-label {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
    }
    .meta-value {
      font-family: var(--font-mono);
      font-size: 12px;
      color: #e5e2e1;
    }

    /* ── Data table ────────────────────────────────────────────────── */
    .table-wrapper { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; min-width: 500px; }
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

    .text-primary { color: #caf300; }
    .text-warning { color: #ffb300; }
    .text-error { color: #ff4b4b; }
    .text-dim { color: #555; }

    /* ── Loading / Empty / Error ───────────────────────────────────── */
    .skeleton-panel { display: flex; flex-direction: column; }
    .skeleton-row {
      height: 48px;
      background: #2a2a29;
      border-bottom: 1px solid #2a2a29;
      animation: pulse 1.5s infinite ease-in-out;
    }
    @keyframes pulse { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }

    .error-panel, .empty-panel {
      display: flex; flex-direction: column; align-items: center;
      padding: 64px 24px; text-align: center; border: 1px solid;
    }
    .error-panel { border-color: #ff4b4b; background: rgba(255,75,75,0.05); }
    .empty-panel { border-color: #353534; background: #1c1b1b; }
    .error-icon, .empty-icon { font-size: 48px; margin-bottom: 16px; }
    .error-icon { color: #ff4b4b; }
    .empty-icon { color: #555; }
    .error-title, .empty-title { font-family: var(--font-primary); font-size: 20px; font-weight: 600; color: #e5e2e1; margin-bottom: 8px; }
    .error-message, .empty-message { font-family: var(--font-mono); font-size: 12px; color: #c8c6c5; margin-bottom: 24px; max-width: 400px; }
    .retry-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px; background: none; border: 1px solid #ff4b4b; color: #ff4b4b;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer;
    }
    .retry-btn:hover { background: #ff4b4b; color: #000; }
  `,
})
export class AdminCompatibilityPage implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly state = signal<LoadState>('loading');
  readonly items = signal<AdminCompatibilityQualityItem[]>([]);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');

    this.api.getCompatibilityQuality().subscribe({
      next: (data) => {
        this.items.set(data.items);
        this.state.set('loaded');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? `HTTP ${err.status}`);
        this.state.set('error');
      },
    });
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }
}
