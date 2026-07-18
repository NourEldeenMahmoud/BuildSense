import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/services/admin-api.service';
import type {
  AdminDataQualityIssueListItem,
  AdminPagination,
  AdminDataQualitySeverity,
  AdminDataQualityIssueStatus,
} from '@buildsense/contracts';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-admin-data-quality',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-grid">
        <div class="filter-cell">
          <label class="filter-label">SEVERITY</label>
          <select class="filter-select" [(ngModel)]="severityFilter" (ngModelChange)="onFilterChange()">
            <option value="">ALL_SEVERITIES</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>
        <div class="filter-cell">
          <label class="filter-label">STATUS</label>
          <select class="filter-select" [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()">
            <option value="">ALL_STATUS</option>
            <option value="OPEN">OPEN</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="IGNORED">IGNORED</option>
          </select>
        </div>
        <div class="filter-cell filter-cell--count">
          <span class="filter-count">
            {{ pagination()?.totalItems ?? 0 }} TOTAL
          </span>
        </div>
      </div>
      <!-- Active filter chips -->
      @if (statusFilter || severityFilter) {
        <div class="active-filters">
          <span class="active-filters__label">ACTIVE_FILTERS:</span>
          @if (statusFilter) {
            <span class="filter-chip">
              STATUS: {{ statusFilter }}
              <button class="filter-chip__close" (click)="statusFilter = ''; onFilterChange()">
                <span class="material-symbols-outlined" style="font-size:12px;">close</span>
              </button>
            </span>
          }
          @if (severityFilter) {
            <span class="filter-chip">
              SEVERITY: {{ severityFilter }}
              <button class="filter-chip__close" (click)="severityFilter = ''; onFilterChange()">
                <span class="material-symbols-outlined" style="font-size:12px;">close</span>
              </button>
            </span>
          }
          <button class="clear-all" (click)="clearFilters()">CLEAR_ALL</button>
        </div>
      }
    </div>

    <!-- Loading state -->
    @if (state() === 'loading') {
      <div class="table-panel">
        <div class="skeleton-row" style="width:100%"></div>
        <div class="skeleton-row" style="width:100%"></div>
        <div class="skeleton-row" style="width:75%"></div>
        <div class="skeleton-row" style="width:60%"></div>
      </div>
    }

    <!-- Error state -->
    @if (state() === 'error') {
      <div class="error-panel">
        <span class="material-symbols-outlined error-icon">error</span>
        <h3 class="error-title">CONNECTION_TIMEOUT</h3>
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
        <span class="material-symbols-outlined empty-icon">inbox</span>
        <h3 class="empty-title">NO DATA QUALITY ISSUES</h3>
        <p class="empty-message">All data quality issues have been resolved or no issues match the current filter.</p>
      </div>
    }

    <!-- Data table -->
    @if (state() === 'loaded' && items().length > 0) {
      <div class="table-panel">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="data-th w-sev">SEV</th>
                <th class="data-th w-type">ISSUE TYPE</th>
                <th class="data-th w-desc">DESCRIPTION</th>
                <th class="data-th w-category">CATEGORY</th>
                <th class="data-th w-created">DETECTED_AT</th>
                <th class="data-th w-status">STATUS</th>
                <th class="data-th w-action">ACTION</th>
              </tr>
            </thead>
            <tbody>
              @for (issue of items(); track issue.id) {
                <tr class="data-tr">
                  <td class="data-td">
                    <span class="sev-badge" [class]="'sev-badge--' + issue.severity.toLowerCase()">
                      <span class="sev-icon" [class]="'sev-icon--' + issue.severity.toLowerCase()">
                        {{ getSeverityIcon(issue.severity) }}
                      </span>
                      {{ formatSeverity(issue.severity) }}
                    </span>
                  </td>
                  <td class="data-td">{{ issue.issueType }}</td>
                  <td class="data-td data-td--desc">{{ issue.description }}</td>
                  <td class="data-td">{{ issue.category ?? '—' }}</td>
                  <td class="data-td data-td--mono">{{ formatDate(issue.createdAt) }}</td>
                  <td class="data-td">
                    <span class="status-badge" [class]="'status-badge--' + issue.status.toLowerCase()">
                      <span class="material-symbols-outlined" style="font-size:14px;">{{ getStatusIcon(issue.status) }}</span>
                      {{ formatStatus(issue.status) }}
                    </span>
                  </td>
                  <td class="data-td data-td--action">
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
            <span class="page-info">
              SHOWING {{ getRangeStart() }}-{{ getRangeEnd() }} OF {{ pagination()!.totalItems | number }} ISSUES
            </span>
            <div class="page-nav">
              <button
                class="page-btn"
                [disabled]="pagination()!.page <= 1"
                (click)="goPage(pagination()!.page - 1)"
              >
                <span class="material-symbols-outlined page-icon">chevron_left</span>
              </button>
              @for (p of getPageNumbers(); track p) {
                <button
                  class="page-btn"
                  [class.page-btn--active]="p === pagination()!.page"
                  (click)="goPage(p)"
                >{{ p }}</button>
              }
              <button
                class="page-btn"
                [disabled]="pagination()!.page >= pagination()!.totalPages"
                (click)="goPage(pagination()!.page + 1)"
              >
                <span class="material-symbols-outlined page-icon">chevron_right</span>
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }

    /* ── Filter bar ──────────────────────────────────────────────────── */
    .filter-bar {
      margin-bottom: 16px;
      background: #1c1b1b;
      border: 1px solid #353534;
    }
    .filter-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr) auto;
      gap: 16px;
      padding: 12px 16px;
      background: #20201f;
      border-bottom: 1px solid #353534;
    }
    .filter-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .filter-cell--count {
      justify-content: flex-end;
    }
    .filter-label {
      font-family: var(--font-mono);
      font-size: 10px;
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
      font-family: var(--font-mono);
      font-size: 11px;
      color: #c8c6c5;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* ── Active filters ──────────────────────────────────────────────── */
    .active-filters {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-top: 1px solid #2a2a29;
      flex-wrap: wrap;
    }
    .active-filters__label {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
    }
    .filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      background: #20201f;
      border: 1px solid #caf300;
      font-family: var(--font-mono);
      font-size: 10px;
      color: #caf300;
    }
    .filter-chip__close {
      background: none;
      border: none;
      color: #caf300;
      cursor: pointer;
      padding: 0;
      display: flex;
    }
    .clear-all {
      margin-left: auto;
      background: none;
      border: none;
      font-family: var(--font-mono);
      font-size: 10px;
      color: #c8c6c5;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .clear-all:hover { color: #e5e2e1; }

    /* ── Table ─────────────────────────────────────────────────────── */
    .table-panel {
      background: #131313;
      border: 1px solid #353534;
      display: flex;
      flex-direction: column;
    }
    .table-wrapper {
      overflow-x: auto;
      width: 100%;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1000px;
    }
    .data-th {
      padding: 8px 16px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
      text-align: left;
      border-bottom: 1px solid #353534;
      background: #20201f;
    }
    .data-th.w-sev { width: 8%; }
    .data-th.w-type { width: 12%; }
    .data-th.w-desc { width: 25%; }
    .data-th.w-category { width: 12%; }
    .data-th.w-created { width: 12%; }
    .data-th.w-status { width: 15%; }
    .data-th.w-action { width: 10%; text-align: right; }

    .data-tr {
      border-bottom: 1px solid #2a2a29;
      transition: background 0.1s;
    }
    .data-tr:hover { background: #1c1b1b; }

    .data-td {
      padding: 12px 16px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #e5e2e1;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .data-td--mono { font-variant-numeric: tabular-nums; }
    .data-td--desc {
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .data-td--action { text-align: right; }

    /* ── Severity badge ─────────────────────────────────────────────── */
    .sev-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .sev-icon {
      display: inline-flex;
      align-items: center;
      font-size: 14px;
    }
    .sev-badge--critical { color: #fff; }
    .sev-icon--critical { color: #fff; }
    .sev-badge--high { color: #ff4b4b; }
    .sev-icon--high { color: #ff4b4b; }
    .sev-badge--medium { color: #caf300; }
    .sev-icon--medium { color: #caf300; }
    .sev-badge--low { color: #c8c6c5; }
    .sev-icon--low { color: #c8c6c5; }

    /* ── Status badge ──────────────────────────────────────────────── */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .status-badge--open { color: #c8c6c5; }
    .status-badge--resolved { color: #caf300; }
    .status-badge--ignored { color: #888; }

    .action-link {
      color: #caf300;
      text-decoration: none;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 4px 8px;
      border: 1px solid #caf300;
      transition: background 0.15s, color 0.15s;
    }
    .action-link:hover { background: #caf300; color: #000; }

    /* ── Pagination ────────────────────────────────────────────────── */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-top: 1px solid #353534;
      background: #0e0e0e;
    }
    .page-info {
      font-family: var(--font-mono);
      font-size: 11px;
      color: #c8c6c5;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .page-nav {
      display: flex;
      gap: 4px;
    }
    .page-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: 1px solid #353534;
      color: #c8c6c5;
      font-family: var(--font-mono);
      font-size: 12px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .page-btn:hover:not(:disabled) { color: #caf300; border-color: #caf300; }
    .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .page-btn--active {
      background: #caf300;
      border-color: #caf300;
      color: #000;
      font-weight: 700;
    }
    .page-icon { font-size: 16px; }

    /* ── Loading skeleton ──────────────────────────────────────────── */
    .skeleton-row {
      height: 48px;
      background: #2a2a29;
      border-bottom: 1px solid #2a2a29;
      animation: pulse 1.5s infinite ease-in-out;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }

    /* ── Error / Empty ─────────────────────────────────────────────── */
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
      font-family: var(--font-mono); font-size: 14px; font-weight: 700;
      color: #e5e2e1; margin-bottom: 8px; text-transform: uppercase;
      letter-spacing: 0.08em;
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

    @media (max-width: 768px) {
      .filter-grid {
        grid-template-columns: 1fr;
      }
    }
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

  clearFilters(): void {
    this.statusFilter = '';
    this.severityFilter = '';
    this.currentPage = 1;
    this.load();
  }

  goPage(page: number): void {
    this.currentPage = page;
    this.load();
  }

  formatSeverity(severity: AdminDataQualitySeverity): string {
    const map: Record<AdminDataQualitySeverity, string> = {
      CRITICAL: 'CRIT',
      HIGH: 'HIGH',
      MEDIUM: 'MED',
      LOW: 'LOW',
    };
    return map[severity] ?? severity;
  }

  getSeverityIcon(severity: AdminDataQualitySeverity): string {
    const map: Record<AdminDataQualitySeverity, string> = {
      CRITICAL: '\u25C6',  // diamond
      HIGH: '\u25A0',      // square
      MEDIUM: '\u25B2',    // triangle
      LOW: '\u2014',       // dash
    };
    return map[severity] ?? '';
  }

  formatStatus(status: AdminDataQualityIssueStatus): string {
    const map: Record<AdminDataQualityIssueStatus, string> = {
      OPEN: 'PENDING_REVIEW',
      RESOLVED: 'RESOLVED',
      IGNORED: 'IGNORED',
    };
    return map[status] ?? status;
  }

  getStatusIcon(status: AdminDataQualityIssueStatus): string {
    const map: Record<AdminDataQualityIssueStatus, string> = {
      OPEN: 'pending',
      RESOLVED: 'check_circle',
      IGNORED: 'block',
    };
    return map[status] ?? 'help';
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

  getRangeStart(): number {
    const p = this.pagination();
    if (!p) return 0;
    return (p.page - 1) * p.pageSize + 1;
  }

  getRangeEnd(): number {
    const p = this.pagination();
    if (!p) return 0;
    return Math.min(p.page * p.pageSize, p.totalItems);
  }

  getPageNumbers(): number[] {
    const p = this.pagination();
    if (!p) return [];
    const pages: number[] = [];
    const start = Math.max(1, p.page - 1);
    const end = Math.min(p.totalPages, p.page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }
}
