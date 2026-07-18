import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/services/admin-api.service';
import type { AdminJobListItem } from '@buildsense/contracts';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-admin-job-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="back-bar">
      <a class="back-link" routerLink="/admin/jobs">
        <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
        JOBS LIST
      </a>
    </div>

    @if (state() === 'loading') {
      <div class="summary-strip"><div class="skeleton-pill" style="width:100px"></div></div>
      <div class="detail-grid">
        <div class="detail-panel"><div class="skeleton-row" style="width:100%;height:32px"></div></div>
      </div>
    }

    @if (state() === 'error') {
      <div class="error-panel">
        <span class="material-symbols-outlined error-icon">bolt</span>
        <h3 class="error-title">Job not found</h3>
        <p class="error-message">{{ errorMessage() }}</p>
        <a class="retry-link" routerLink="/admin/jobs">BACK TO JOBS</a>
      </div>
    }

    @if (state() === 'loaded' && job()) {
      <div class="summary-strip">
        <span class="status-badge" [class]="'status-badge--' + job()!.status.toLowerCase()">
          <span class="status-dot"></span>{{ job()!.status }}
        </span>
        <span class="summary-divider">/</span>
        <span class="summary-type">{{ job()!.jobType }}</span>
        <span class="summary-divider">/</span>
        <span class="summary-id">{{ job()!.id }}</span>
      </div>

      <div class="detail-grid">
        <div class="detail-panel">
          <div class="detail-header">
            <span class="material-symbols-outlined detail-icon">info</span>
            <h3 class="detail-title">Job Info</h3>
          </div>
          <div class="detail-body">
            <div class="detail-field">
              <span class="detail-label">STATUS</span>
              <span class="status-badge" [class]="'status-badge--' + job()!.status.toLowerCase()">
                <span class="status-dot"></span>{{ job()!.status }}
              </span>
            </div>
            <div class="detail-field">
              <span class="detail-label">JOB TYPE</span>
              <span class="detail-value">{{ job()!.jobType }}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">REQUESTED BY</span>
              <span class="detail-value detail-value--mono">{{ job()!.requestedBy }}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">CREATED AT</span>
              <span class="detail-value detail-value--mono">{{ formatDateTime(job()!.createdAt) }}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">ATTEMPTS</span>
              <span class="detail-value detail-value--mono">{{ job()!.attempts }} / {{ job()!.maxAttempts }}</span>
            </div>
          </div>
        </div>

        <div class="detail-panel">
          <div class="detail-header">
            <span class="material-symbols-outlined detail-icon">schedule</span>
            <h3 class="detail-title">Execution</h3>
          </div>
          <div class="detail-body">
            <div class="detail-field">
              <span class="detail-label">CLAIMED BY</span>
              <span class="detail-value detail-value--mono">{{ job()!.claimedBy ?? '\u2014 not yet claimed \u2014' }}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">CLAIMED AT</span>
              <span class="detail-value detail-value--mono">{{ formatDateTime(job()!.claimedAt) }}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">COMPLETED AT</span>
              <span class="detail-value detail-value--mono">{{ formatDateTime(job()!.completedAt) }}</span>
            </div>
          </div>
        </div>

        <div class="detail-panel">
          <div class="detail-header">
            <span class="material-symbols-outlined detail-icon">code</span>
            <h3 class="detail-title">Params</h3>
          </div>
          <div class="detail-body">
            <pre class="json-block">{{ formatJson(job()!.params) }}</pre>
          </div>
        </div>

        <div class="detail-panel">
          <div class="detail-header">
            <span class="material-symbols-outlined detail-icon">
              {{ job()!.status === 'FAILED' ? 'error' : 'output' }}
            </span>
            <h3 class="detail-title">{{ job()!.status === 'FAILED' ? 'Error Summary' : 'Result' }}</h3>
          </div>
          <div class="detail-body">
            @if (job()!.errorSummary) {
              <div class="error-block">
                <span class="material-symbols-outlined error-block-icon">error</span>
                <span class="error-block-text">{{ job()!.errorSummary }}</span>
              </div>
            } @else if (job()!.result) {
              <pre class="json-block">{{ formatJson(job()!.result) }}</pre>
            } @else {
              <span class="detail-empty">No result or error recorded yet.</span>
            }
          </div>
        </div>

        <div class="detail-panel">
          <div class="detail-header">
            <span class="material-symbols-outlined detail-icon">chat</span>
            <h3 class="detail-title">Reason</h3>
          </div>
          <div class="detail-body">
            <p class="reason-text">{{ job()!.reason }}</p>
          </div>
        </div>

        <div class="detail-panel">
          <div class="detail-header">
            <span class="material-symbols-outlined detail-icon">build</span>
            <h3 class="detail-title">Actions // Enqueue Only</h3>
          </div>
          <div class="detail-body">
            <p class="action-note">Re-enqueue this job for the worker to pick up. Execution is worker-owned.</p>
            <p class="action-disabled-note">Worker job processors are not yet implemented. Re-enqueue is available via API but the worker cannot execute jobs yet.</p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .back-bar { margin-bottom: 16px; }
    .back-link {
      display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px;
      border: 1px solid #353534; background: #1c1b1b; color: #c8c6c5;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none;
      transition: color 0.15s, border-color 0.15s;
    }
    .back-link:hover { color: #caf300; border-color: #caf300; }

    .summary-strip {
      display: flex; align-items: center; gap: 12px; padding: 12px 16px;
      background: #1c1b1b; border: 1px solid #353534; margin-bottom: 16px;
    }
    .summary-divider { color: #353534; font-family: var(--font-mono); font-size: 14px; }
    .summary-type {
      font-family: var(--font-mono); font-size: 13px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em; color: #e5e2e1;
    }
    .summary-id { font-family: var(--font-mono); font-size: 12px; color: #888; letter-spacing: 0.03em; }

    .status-badge {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
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

    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 960px) { .detail-grid { grid-template-columns: 1fr; } }

    .detail-panel { background: #1c1b1b; border: 1px solid #353534; }
    .detail-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 16px 12px; border-bottom: 1px solid #353534;
    }
    .detail-icon { font-size: 24px; color: #c8c6c5; }
    .detail-title {
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #c8c6c5;
    }
    .detail-body { padding: 16px; }

    .detail-field { margin-bottom: 12px; }
    .detail-field:last-child { margin-bottom: 0; }
    .detail-label {
      display: block; font-family: var(--font-mono); font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 4px;
    }
    .detail-value { font-family: var(--font-mono); font-size: 13px; color: #e5e2e1; letter-spacing: 0.02em; }
    .detail-value--mono { font-variant-numeric: tabular-nums; }
    .detail-empty { font-family: var(--font-mono); font-size: 12px; color: #555; }

    .json-block {
      background: #0e0e0e; border: 1px solid #2a2a29; padding: 12px;
      font-family: var(--font-mono); font-size: 11px; color: #c8c6c5;
      overflow-x: auto; white-space: pre; line-height: 1.6; margin: 0;
    }

    .error-block {
      display: flex; align-items: flex-start; gap: 12px; padding: 12px;
      border: 1px solid #ff4b4b; background: rgba(255,75,75,0.05);
    }
    .error-block-icon { font-size: 20px; color: #ff4b4b; flex-shrink: 0; margin-top: 1px; }
    .error-block-text { font-family: var(--font-mono); font-size: 12px; color: #ff4b4b; line-height: 1.6; }

    .reason-text { font-family: var(--font-mono); font-size: 12px; color: #c8c6c5; line-height: 1.6; margin: 0; }

    .action-note { font-family: var(--font-mono); font-size: 11px; color: #888; margin-bottom: 12px; line-height: 1.5; }
    .action-disabled-note { font-family: var(--font-mono); font-size: 11px; color: #ffb300; margin-bottom: 12px; line-height: 1.5; }
    .action-btn {
      display: inline-flex; align-items: center; gap: 10px; padding: 10px 20px;
      background: none; border: 1px solid #353534; color: #e5e2e1;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; transition: all 0.15s;
    }
    .action-btn:hover:not(:disabled) { border-color: #caf300; color: #caf300; }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .action-success {
      display: flex; align-items: center; gap: 12px; margin-top: 12px;
      padding: 12px; border: 1px solid #caf300; background: rgba(202,243,0,0.05);
    }
    .success-icon { font-size: 24px; color: #caf300; }
    .success-text { font-family: var(--font-mono); font-size: 12px; color: #caf300; }
    .action-error {
      display: flex; align-items: center; gap: 12px; margin-top: 12px;
      padding: 12px; border: 1px solid #ff4b4b; background: rgba(255,75,75,0.05);
    }
    .error-action-icon { font-size: 24px; color: #ff4b4b; }
    .error-action-text { font-family: var(--font-mono); font-size: 12px; color: #ff4b4b; }

    .error-panel {
      display: flex; flex-direction: column; align-items: center;
      padding: 64px 24px; text-align: center; border: 1px solid #ff4b4b;
      background: rgba(255,75,75,0.05);
    }
    .error-icon { font-size: 48px; color: #ff4b4b; margin-bottom: 16px; }
    .error-title { font-family: var(--font-primary); font-size: 20px; font-weight: 600; color: #e5e2e1; margin-bottom: 8px; }
    .error-message { font-family: var(--font-mono); font-size: 12px; color: #c8c6c5; margin-bottom: 24px; max-width: 400px; }
    .retry-link {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px; background: none; border: 1px solid #ff4b4b; color: #ff4b4b;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none; transition: all 0.15s;
    }
    .retry-link:hover { background: #ff4b4b; color: #000; }

    .skeleton-pill { height: 24px; background: #2a2a29; animation: pulse 1.5s infinite ease-in-out; }
    .skeleton-row { height: 32px; background: #2a2a29; animation: pulse 1.5s infinite ease-in-out; }
    @keyframes pulse { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }
  `],
})
export class AdminJobDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AdminApiService);

  readonly state = signal<LoadState>('loading');
  readonly job = signal<AdminJobListItem | null>(null);
  readonly errorMessage = signal('');
  readonly isSubmitting = signal(false);
  readonly reprocessSuccess = signal<string | null>(null);
  readonly reprocessError = signal<string | null>(null);

  private jobId = '';

  ngOnInit(): void {
    this.jobId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');

    this.api.getJob(this.jobId).subscribe({
      next: (data) => {
        this.job.set(data);
        this.state.set('loaded');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? `HTTP ${err.status}`);
        this.state.set('error');
      },
    });
  }

  submitReprocess(): void {
    const j = this.job();
    if (!j) return;

    this.isSubmitting.set(true);
    this.reprocessError.set(null);
    this.reprocessSuccess.set(null);

    this.api.requestReprocessJob({
      jobType: j.jobType,
      reason: `Re-enqueue of ${j.id} (${j.status})`,
      ...(j.params && Object.keys(j.params).length > 0 ? { params: j.params } : {}),
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.reprocessSuccess.set('Job enqueued. Worker will pick it up.');
        this.load();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.reprocessError.set(err?.error?.error ?? `HTTP ${err.status}: Enqueue failed`);
      },
    });
  }

  formatDateTime(iso: string | null): string {
    if (!iso) return '\u2014';
    const d = new Date(iso);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${da} ${h}:${mi}`;
  }

  formatJson(obj: Record<string, unknown> | null): string {
    if (!obj || Object.keys(obj).length === 0) return '\u2014';
    return JSON.stringify(obj, null, 2);
  }
}
