import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../core/services/admin-api.service';
import type { AdminReferenceDatasetItem } from '@buildsense/contracts';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-admin-reference-data',
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
        <h3 class="error-title">Failed to load reference data</h3>
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
        <span class="material-symbols-outlined empty-icon">database</span>
        <h3 class="empty-title">No reference datasets</h3>
        <p class="empty-message">Compatibility reference datasets will appear here once published.</p>
      </div>
    }

    <!-- Data loaded -->
    @if (state() === 'loaded' && items().length > 0) {
      <div class="table-panel">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="data-th">VERSION</th>
                <th class="data-th">PUBLISHED</th>
                <th class="data-th">CITATION</th>
                <th class="data-th data-th--right">CHIPSETS</th>
              </tr>
            </thead>
            <tbody>
              @for (ds of items(); track ds.version) {
                <tr class="data-tr">
                  <td class="data-td">
                    <span class="version-tag">{{ ds.version }}</span>
                  </td>
                  <td class="data-td data-td--mono">{{ formatDate(ds.publishedAt) }}</td>
                  <td class="data-td data-td--citation">{{ ds.citation }}</td>
                  <td class="data-td data-td--mono data-td--right">{{ ds.chipsetCount | number }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }

    .table-panel {
      background: #1c1b1b;
      border: 1px solid #353534;
    }
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
    .data-td--citation {
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .version-tag {
      padding: 2px 6px;
      border: 1px solid #caf300;
      color: #caf300;
      background: rgba(202,243,0,0.1);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
    }

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
export class AdminReferenceDataPage implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly state = signal<LoadState>('loading');
  readonly items = signal<AdminReferenceDatasetItem[]>([]);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');

    this.api.getReferenceDatasets().subscribe({
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
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${da} ${h}:${mi}`;
  }
}
