import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/services/admin-api.service';
import type {
  AdminDataQualityIssueListItem,
  AdminPagination,
} from '@buildsense/contracts';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-admin-data-quality',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">STATUS</span>
        <select class="filter-select" [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()">
          <option value="">ALL</option>
          <option value="OPEN">OPEN</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="IGNORED">IGNORED</option>
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">SEVERITY</span>
        <select class="filter-select" [(ngModel)]="severityFilter" (ngModelChange)="onFilterChange()">
          <option value="">ALL</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
      </div>
      <span class="filter-count">
        {{ pagination()?.totalItems ?? 0 }} total
      </span>
    </div>

    <!-- Loading skeleton -->
    @if (state() === 'loading') {
      <div class="table-panel">
        <div class="skeleton-row" style="width:100%"></div>
        <div class="skeleton-row" style="width:100%"></div>
        <div class="skeleton-row" style="width:75%"></div>
      </div>
    }

    <!-- Error state -->
    @if (state() === 'error') {
      <div class="error-panel">
        <span class="material-symbols-outlined error-icon">bolt</span>
        <h3 class="error-title">Failed to load data quality issues</h3>
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
        <span class="material-symbols-outlined empty-icon">check_circle</span>
        <h3 class="empty-title">No data quality issues</h3>
        <p class="empty-message">All data quality issues have been resolved.</p>
      </div>
    }

    <!-- Data table -->
    @if (state() === 'loaded' && items().length > 0) {
      <div class="table-panel">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="data-th">STATUS</th>
                <th class="data-th">SEVERITY</th>
                <th class="data-th">ISSUE TYPE</th>
                <th class="data-th">CATEGORY</th>
                <th class="data-th">DESCRIPTION</th>
                <th class="data-th">CREATED</th>
                <th class="data-th data-th--right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              @for (issue of items(); track issue.id) {
                <tr class="data-tr">
                  <td class="data-td">
                    <span class="status-badge" [class]="'status-badge--' + issue.status.toLowerCase()">
                      <span class="status-dot"></span>
                      {{ issue.status }}
                    </span>
                  </td>
                  <td class="data-td">
                    <span class="severity-badge" [class]="'severity-badge--' + issue.severity.toLowerCase()">
                      {{ issue.severity }}
                    </span>
                  </td>
                  <td class="data-td">{{ issue.issueType }}</td>
                  <td class="data-td">{{ issue.category ?? '—' }}</td>
                  <td class="data-td data-td--desc">{{ issue.description }}</td>
                  <td class="data-td data-td--mono">{{ formatDate(issue.createdAt) }}</td>
                  <td class="data-td data-td--right">
                    <a class="action-link" [routerLink]="['/admin/data-quality', issue.id]">
                      @if (issue.status === 'OPEN') { RESOLVE } @else { VIEW }
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (pagination() && pagination()!.totalPages > 1) {
          <div class="pagination">
            <button
              class="page-btn"
              [disabled]="pagination()!.page <= 1"
              (click)="goPage(pagination()!.page - 1)"
            >PREV</button>
            <span class="page-info">
              PAGE {{ pagination()!.page }} / {{ pagination()!.totalPages }}
            </span>
            <button
              class="page-btn"
              [disabled]="pagination()!.page >= pagination()!.totalPages"
              (click)="goPage(pagination()!.page + 1)"
            >NEXT</button>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }

    .filter-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #1c1b1b;
      border: 1px solid #353534;
      flex-wrap: wrap;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .filter-label {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
    }
    .filter-select {
      background: #0e0e0e;
      border: 1px solid #353534;
      color: #e5e2e1;
      padding: 6px 12px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      outline: none;
    }
    .filter-select:focus { border-color: #caf300; }
    .filter-count {
      margin-left: auto;
      font-family: var(--font-mono);
      font-size: 11px;
      color: #c8c6c5;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .table-panel { background: #1c1b1b; border: 1px solid #353534; }
    .table-wrapper { overflow-x: auto; width: 100%; }
    .data-table { width: 100%; border-collapse: collapse; min-width: 900px; }
    .data-th {
      padding: 8px 16px; font-family: var(--font-mono); font-size: 11px;
      font-weight: 400; text-transform: uppercase; letter-spacing: 0.08em;
      color: #c8c6c5; text-align: left; border-bottom: 1px solid #353534; background: #0e0e0e;
    }
    .data-th--right { text-align: right; }
    .data-tr { border-bottom: 1px solid #2a2a29; transition: background 0.1s; }
    .data-tr:hover { background: #131313; }
    .data-td {
      padding: 12px 16px; font-family: var(--font-mono); font-size: 12px;
      color: #e5e2e1; letter-spacing: 0.02em; white-space: nowrap;
    }
    .data-td--mono { font-variant-numeric: tabular-nums; }
    .data-td--right { text-align: right; }
    .data-td--desc { max-width: 300px; overflow: hidden; text-overflow: ellipsis; }

    .status-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 8px; font-family: var(--font-mono); font-size: 10px;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid;
    }
    .status-dot { width: 6px; height: 6px; }
    .status-badge--open { border-color: #ffb300; background: rgba(255,179,0,0.1); color: #ffb300; }
    .status-badge--open .status-dot { background: #ffb300; }
    .status-badge--resolved { border-color: #caf300; background: rgba(202,243,0,0.1); color: #caf300; }
    .status-badge--resolved .status-dot { background: #caf300; }
    .status-badge--ignored { border-color: #555; background: rgba(85,85,85,0.1); color: #888; }
    .status-badge--ignored .status-dot { background: #888; }

    .severity-badge {
      display: inline-block; padding: 2px 6px;
      font-family: var(--font-mono); font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid;
    }
    .severity-badge--critical { border-color: #ff4b4b; color: #ff4b4b; background: rgba(255,75,75,0.1); }
    .severity-badge--high { border-color: #ff6b35; color: #ff6b35; background: rgba(255,107,53,0.1); }
    .severity-badge--medium { border-color: #ffb300; color: #ffb300; background: rgba(255,179,0,0.1); }
    .severity-badge--low { border-color: #c8c6c5; color: #c8c6c5; background: rgba(200,198,197,0.1); }

    .action-link {
      color: #caf300; text-decoration: none; font-family: var(--font-mono);
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      padding: 4px 8px; border: 1px solid #caf300; transition: background 0.15s, color 0.15s;
    }
    .action-link:hover { background: #caf300; color: #000; }

    .pagination {
      display: flex; align-items: center; justify-content: center; gap: 16px;
      padding: 16px; border-top: 1px solid #353534;
    }
    .page-btn {
      padding: 8px 16px; background: none; border: 1px solid #353534;
      color: #c8c6c5; font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .page-btn:hover:not(:disabled) { color: #caf300; border-color: #caf300; }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-info {
      font-family: var(--font-mono); font-size: 11px; color: #c8c6c5;
      text-transform: uppercase; letter-spacing: 0.08em;
    }

    .skeleton-row {
      height: 48px; background: #2a2a29; border-bottom: 1px solid #2a2a29;
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
    .error-title, .empty-title {
      font-family: var(--font-primary); font-size: 20px; font-weight: 600;
      color: #e5e2e1; margin-bottom: 8px;
    }
    .error-message, .empty-message {
      font-family: var(--font-mono); font-size: 12px; color: #c8c6c5;
      margin-bottom: 24px; max-width: 400px;
    }
    .retry-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px; background: none; border: 1px solid #ff4b4b; color: #ff4b4b;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer;
    }
    .retry-btn:hover { background: #ff4b4b; color: #000; }
  `,
})
export class AdminDataQualityPage implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly state = signal<LoadState>('loading');
  readonly items = signal<AdminDataQualityIssueListItem[]>([]);
  readonly pagination = signal<AdminPagination | null>(null);
  readonly errorMessage = signal('');
  statusFilter = '';
  severityFilter = '';
  private currentPage = 1;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');

    const query: { page: string; pageSize: string; status?: string; severity?: string } = {
      page: String(this.currentPage),
      pageSize: '20',
    };
    if (this.statusFilter) query.status = this.statusFilter;
    if (this.severityFilter) query.severity = this.severityFilter;

    this.api.getDataQualityIssues(query).subscribe({
      next: (data) => {
        this.items.set(data.items);
        this.pagination.set(data.pagination);
        this.state.set('loaded');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? `HTTP ${err.status}`);
        this.state.set('error');
      },
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.load();
  }

  goPage(page: number): void {
    this.currentPage = page;
    this.load();
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${da} ${h}:${mi}`;
  }
}
