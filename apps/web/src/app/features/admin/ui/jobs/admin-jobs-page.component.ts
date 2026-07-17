import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/services/admin-api.service';
import type {
  AdminJobListItem,
  AdminPagination,
  AdminJobType,
  AdminJobReprocessRequest,
} from '@buildsense/contracts';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-admin-jobs',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <!-- Info banner -->
    <div class="info-banner">
      <span class="material-symbols-outlined" style="font-size:16px;color:#caf300;">info</span>
      <span class="info-banner-text">
        Jobs are enqueued for worker processing. The worker owns execution; this interface only submits requests.
      </span>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">STATUS</span>
        <select class="filter-select" [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()">
          <option value="">ALL</option>
          <option value="PENDING">PENDING</option>
          <option value="CLAIMED">CLAIMED</option>
          <option value="RUNNING">RUNNING</option>
          <option value="SUCCEEDED">SUCCEEDED</option>
          <option value="FAILED">FAILED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">TYPE</span>
        <select class="filter-select" [(ngModel)]="typeFilter" (ngModelChange)="onFilterChange()">
          <option value="">ALL</option>
          <option value="REPROCESS_CATALOG">REPROCESS_CATALOG</option>
          <option value="BACKFILL_FACTS">BACKFILL_FACTS</option>
          <option value="REPROCESS_CATEGORY">REPROCESS_CATEGORY</option>
        </select>
      </div>
      <span class="filter-count">
        {{ pagination()?.totalItems ?? 0 }} total
      </span>
    </div>

    <!-- New job panel (disabled — no worker processors implemented yet) -->
    <div class="action-panel action-panel--disabled">
      <div class="action-panel-header">
        <h3 class="action-panel-title">ENQUEUE JOB // Worker-Owned Execution</h3>
      </div>
      <div class="action-panel-body">
        <button class="action-btn" disabled>
          <span class="material-symbols-outlined" style="font-size:18px;">add_task</span>
          ENQUEUE NEW JOB
        </button>
        <p class="action-disabled-note">Job processors are not yet implemented. Jobs can be enqueued via API but the worker cannot execute them yet.</p>
      </div>
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
        <h3 class="error-title">Failed to load jobs</h3>
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
        <span class="material-symbols-outlined empty-icon">workspaces</span>
        <h3 class="empty-title">No jobs</h3>
        <p class="empty-message">No worker jobs have been enqueued yet.</p>
      </div>
    }

    <!-- Jobs table -->
    @if (state() === 'loaded' && items().length > 0) {
      <div class="table-panel">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="data-th">STATUS</th>
                <th class="data-th">TYPE</th>
                <th class="data-th">REASON</th>
                <th class="data-th">ATTEMPTS</th>
                <th class="data-th">REQUESTED BY</th>
                <th class="data-th">CREATED</th>
                <th class="data-th">COMPLETED</th>
                <th class="data-th data-th--right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              @for (job of items(); track job.id) {
                <tr class="data-tr">
                  <td class="data-td">
                    <span class="status-badge" [class]="'status-badge--' + job.status.toLowerCase()">
                      <span class="status-dot"></span>
                      {{ job.status }}
                    </span>
                  </td>
                  <td class="data-td">
                    <span class="type-tag">{{ job.jobType }}</span>
                  </td>
                  <td class="data-td data-td--reason">{{ job.reason }}</td>
                  <td class="data-td data-td--mono">
                    {{ job.attempts }}/{{ job.maxAttempts }}
                  </td>
                  <td class="data-td data-td--mono">{{ job.requestedBy }}</td>
                  <td class="data-td data-td--mono">{{ formatDate(job.createdAt) }}</td>
                  <td class="data-td data-td--mono">{{ formatDate(job.completedAt) }}</td>
                  <td class="data-td data-td--right">
                    <a class="action-link" [routerLink]="['/admin/jobs', job.id]">VIEW</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

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

    .info-banner {
      display: flex; align-items: center; gap: 10px; padding: 12px 16px;
      background: #1c1b1b; border: 1px solid #353534; margin-bottom: 16px;
    }
    .info-banner-text {
      font-family: var(--font-mono); font-size: 11px; color: #c8c6c5;
      text-transform: uppercase; letter-spacing: 0.03em;
    }

    .filter-bar {
      display: flex; align-items: center; gap: 16px; margin-bottom: 16px;
      padding: 12px 16px; background: #1c1b1b; border: 1px solid #353534; flex-wrap: wrap;
    }
    .filter-group { display: flex; align-items: center; gap: 8px; }
    .filter-label {
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #c8c6c5;
    }
    .filter-select {
      background: #0e0e0e; border: 1px solid #353534; color: #e5e2e1;
      padding: 6px 12px; font-family: var(--font-mono); font-size: 11px;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      cursor: pointer; outline: none;
    }
    .filter-select:focus { border-color: #caf300; }
    .filter-count {
      margin-left: auto; font-family: var(--font-mono); font-size: 11px;
      color: #c8c6c5; text-transform: uppercase; letter-spacing: 0.05em;
    }

    /* ── Action panel ──────────────────────────────────────────────── */
    .action-panel {
      background: #1c1b1b; border: 1px solid #353534; margin-bottom: 16px;
    }
    .action-panel-header { padding: 16px; border-bottom: 1px solid #353534; }
    .action-panel-title {
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #caf300;
    }
    .action-panel-body { padding: 16px; }
    .action-panel--disabled { opacity: 0.7; }
    .action-disabled-note {
      font-family: var(--font-mono); font-size: 11px; color: #ffb300;
      margin-top: 12px; line-height: 1.5;
    }

    .action-btn {
      display: flex; align-items: center; gap: 10px; padding: 12px 16px;
      background: none; border: 1px solid #353534; color: #e5e2e1;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer;
      transition: all 0.15s;
    }
    .action-btn:hover { border-color: #caf300; color: #caf300; }

    .enqueue-form { display: flex; flex-direction: column; gap: 12px; }
    .action-row { display: flex; gap: 12px; }
    @media (max-width: 768px) { .action-row { flex-direction: column; } }
    .form-field--wide { flex: 1; }
    .form-field { display: flex; flex-direction: column; gap: 4px; }
    .form-label {
      font-family: var(--font-mono); font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #c8c6c5;
    }
    .form-input, .form-select, .form-textarea {
      background: #0e0e0e; border: 1px solid #353534; color: #e5e2e1;
      padding: 10px 12px; font-family: var(--font-mono); font-size: 12px;
      outline: none; transition: border-color 0.15s; resize: vertical;
    }
    .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #caf300; }
    .form-input::placeholder, .form-textarea::placeholder { color: #555; }
    .form-input:disabled { opacity: 0.4; cursor: not-allowed; }
    .form-select { cursor: pointer; }

    .form-actions { display: flex; gap: 8px; }
    .form-btn {
      padding: 10px 20px; font-family: var(--font-mono); font-size: 11px;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      cursor: pointer; transition: all 0.15s; border: 1px solid;
    }
    .form-btn--submit { background: #caf300; border-color: #caf300; color: #000; }
    .form-btn--submit:hover:not(:disabled) { background: #b0d500; }
    .form-btn--submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .form-btn--cancel { background: none; border-color: #353534; color: #c8c6c5; }
    .form-btn--cancel:hover { border-color: #c8c6c5; color: #e5e2e1; }

    .action-success {
      display: flex; align-items: center; gap: 12px; padding: 12px;
      border: 1px solid #caf300; background: rgba(202,243,0,0.05);
    }
    .success-icon { font-size: 24px; color: #caf300; }
    .success-text { font-family: var(--font-mono); font-size: 12px; color: #caf300; }
    .action-error {
      display: flex; align-items: center; gap: 12px; padding: 12px;
      border: 1px solid #ff4b4b; background: rgba(255,75,75,0.05);
    }
    .error-action-icon { font-size: 24px; color: #ff4b4b; }
    .error-action-text { font-family: var(--font-mono); font-size: 12px; color: #ff4b4b; }

    /* ── Table ─────────────────────────────────────────────────────── */
    .table-panel { background: #1c1b1b; border: 1px solid #353534; }
    .table-wrapper { overflow-x: auto; width: 100%; }
    .data-table { width: 100%; border-collapse: collapse; min-width: 1000px; }
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
    .data-td--reason { max-width: 250px; overflow: hidden; text-overflow: ellipsis; }

    .status-badge {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px;
      font-family: var(--font-mono); font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid;
    }
    .status-dot { width: 6px; height: 6px; }
    .status-badge--pending { border-color: #ffb300; background: rgba(255,179,0,0.1); color: #ffb300; }
    .status-badge--pending .status-dot { background: #ffb300; }
    .status-badge--claimed { border-color: #c8c6c5; background: rgba(200,198,197,0.1); color: #c8c6c5; }
    .status-badge--claimed .status-dot { background: #c8c6c5; }
    .status-badge--running { border-color: #4fc3f7; background: rgba(79,195,247,0.1); color: #4fc3f7; }
    .status-badge--running .status-dot { background: #4fc3f7; }
    .status-badge--succeeded { border-color: #caf300; background: rgba(202,243,0,0.1); color: #caf300; }
    .status-badge--succeeded .status-dot { background: #caf300; }
    .status-badge--failed { border-color: #ff4b4b; background: rgba(255,75,75,0.1); color: #ff4b4b; }
    .status-badge--failed .status-dot { background: #ff4b4b; }
    .status-badge--cancelled { border-color: #555; background: rgba(85,85,85,0.1); color: #888; }
    .status-badge--cancelled .status-dot { background: #888; }

    .type-tag {
      display: inline-block; padding: 2px 6px; font-family: var(--font-mono);
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; border: 1px solid #353534; color: #c8c6c5;
    }

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
export class AdminJobsPage implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly state = signal<LoadState>('loading');
  readonly items = signal<AdminJobListItem[]>([]);
  readonly pagination = signal<AdminPagination | null>(null);
  readonly errorMessage = signal('');
  readonly showEnqueueForm = signal(false);
  readonly isSubmitting = signal(false);
  readonly enqueueSuccess = signal<string | null>(null);
  readonly enqueueError = signal<string | null>(null);

  statusFilter = '';
  typeFilter = '';
  enqueueJobType = '';
  enqueueCategory = '';
  enqueueReason = '';
  private currentPage = 1;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');

    const query: { page: string; pageSize: string; status?: string; jobType?: string } = {
      page: String(this.currentPage),
      pageSize: '20',
    };
    if (this.statusFilter) query.status = this.statusFilter;
    if (this.typeFilter) query.jobType = this.typeFilter;

    this.api.getJobs(query).subscribe({
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

  submitEnqueue(): void {
    if (!this.enqueueJobType || !this.enqueueReason.trim()) return;

    this.isSubmitting.set(true);
    this.enqueueError.set(null);

    const request: AdminJobReprocessRequest = {
      jobType: this.enqueueJobType as AdminJobType,
      reason: this.enqueueReason.trim(),
    };
    if (this.enqueueJobType === 'REPROCESS_CATEGORY' && this.enqueueCategory.trim()) {
      request.params = { category: this.enqueueCategory.trim() };
    }

    this.api.requestReprocessJob(request).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.enqueueSuccess.set('Job enqueued. Worker will pick it up for processing.');
        this.showEnqueueForm.set(false);
        this.enqueueJobType = '';
        this.enqueueCategory = '';
        this.enqueueReason = '';
        this.load();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.enqueueError.set(err?.error?.error ?? `HTTP ${err.status}: Enqueue failed`);
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
    return `${y}-${mo}-${da} ${h}:${mi}`;
  }
}
