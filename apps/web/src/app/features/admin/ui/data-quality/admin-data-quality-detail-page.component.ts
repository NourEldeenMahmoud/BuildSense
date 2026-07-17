import { Component, inject, OnInit, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/services/admin-api.service';
import type { AdminDataQualityIssueDetailResponse } from '@buildsense/contracts';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-admin-data-quality-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <a class="back-link" routerLink="/admin/data-quality">
      <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
      DATA QUALITY
    </a>

    @if (state() === 'loading') {
      <div class="detail-panels">
        <div class="detail-panel">
          <div class="skeleton-label" style="width:120px"></div>
          <div class="skeleton-value" style="width:200px"></div>
        </div>
      </div>
    }

    @if (state() === 'error') {
      <div class="error-panel">
        <span class="material-symbols-outlined error-icon">bolt</span>
        <h3 class="error-title">Failed to load issue</h3>
        <p class="error-message">{{ errorMessage() }}</p>
        <button class="retry-btn" (click)="load()">
          <span class="material-symbols-outlined" style="font-size:16px;">refresh</span>
          RETRY
        </button>
      </div>
    }

    @if (state() === 'loaded' && issue()) {
      <!-- Summary strip -->
      <div class="summary-strip">
        <div class="summary-item">
          <span class="summary-label">STATUS</span>
          <span class="status-badge" [class]="'status-badge--' + issue()!.status.toLowerCase()">
            <span class="status-dot"></span>
            {{ issue()!.status }}
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">SEVERITY</span>
          <span class="severity-badge" [class]="'severity-badge--' + issue()!.severity.toLowerCase()">
            {{ issue()!.severity }}
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">ISSUE TYPE</span>
          <span class="summary-value">{{ issue()!.issueType }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">CATEGORY</span>
          <span class="summary-value">{{ issue()!.category ?? '—' }}</span>
        </div>
      </div>

      <div class="detail-panels">
        <!-- Info panel -->
        <div class="detail-panel">
          <div class="panel-header">
            <h3 class="panel-title">ISSUE_INFO // Diagnostic Details</h3>
          </div>
          <div class="panel-body">
            <div class="info-grid">
              <div class="info-row info-row--column">
                <span class="info-label">DESCRIPTION</span>
                <span class="info-value info-value--block">{{ issue()!.description }}</span>
              </div>
              @if (issue()!.catalogProductId) {
                <div class="info-row">
                  <span class="info-label">CATALOG PRODUCT</span>
                  <span class="info-value">{{ issue()!.catalogProductId }}</span>
                </div>
              }
              @if (issue()!.rawSnapshotId) {
                <div class="info-row">
                  <span class="info-label">RAW SNAPSHOT</span>
                  <span class="info-value">{{ issue()!.rawSnapshotId }}</span>
                </div>
              }
              <div class="info-row">
                <span class="info-label">CREATED</span>
                <span class="info-value">{{ formatDate(issue()!.createdAt) }}</span>
              </div>
              @if (issue()!.resolvedAt) {
                <div class="info-row-divider"></div>
                <div class="info-row">
                  <span class="info-label">RESOLVED BY</span>
                  <span class="info-value">{{ issue()!.resolvedBy ?? '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">RESOLUTION</span>
                  <span class="info-value info-value--block">{{ issue()!.resolutionReason ?? '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">RESOLVED AT</span>
                  <span class="info-value">{{ formatDate(issue()!.resolvedAt) }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Actions panel -->
        <div class="detail-panel">
          <div class="panel-header">
            <h3 class="panel-title">ACTIONS // Resolve Issue</h3>
          </div>
          <div class="panel-body">
            @if (issue()!.status === 'OPEN') {
              <div class="actions-grid">
                @if (!showResolveForm()) {
                  <div class="action-buttons">
                    <button class="action-btn action-btn--resolve" (click)="showResolveForm.set(true)">
                      <span class="material-symbols-outlined" style="font-size:18px;">check_circle</span>
                      RESOLVE ISSUE
                    </button>
                  </div>
                }

                @if (showResolveForm()) {
                  <div class="action-form">
                    <h4 class="action-form-title">Resolve Data Quality Issue</h4>
                    <div class="form-field">
                      <label class="form-label">RESOLUTION REASON *</label>
                      <textarea
                        class="form-textarea"
                        [(ngModel)]="resolveReason"
                        placeholder="Explain how this issue was resolved or why it should be closed."
                        rows="4"
                      ></textarea>
                    </div>
                    <div class="form-actions">
                      <button
                        class="form-btn form-btn--submit"
                        [disabled]="!resolveReason.trim() || isSubmitting()"
                        (click)="submitResolve()"
                      >
                        @if (isSubmitting()) { SUBMITTING... } @else { CONFIRM RESOLVE }
                      </button>
                      <button class="form-btn form-btn--cancel" (click)="showResolveForm.set(false)">CANCEL</button>
                    </div>
                  </div>
                }

                @if (actionSuccess()) {
                  <div class="action-success">
                    <span class="material-symbols-outlined success-icon">check_circle</span>
                    <p class="success-text">{{ actionSuccess() }}</p>
                  </div>
                }

                @if (actionError()) {
                  <div class="action-error">
                    <span class="material-symbols-outlined error-action-icon">error</span>
                    <p class="error-action-text">{{ actionError() }}</p>
                  </div>
                }
              </div>
            } @else {
              <div class="resolved-notice">
                <span class="material-symbols-outlined" style="font-size:32px;color:#caf300;">verified</span>
                <p class="resolved-text">This issue has been {{ issue()!.status.toLowerCase() }}.</p>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }

    .back-link {
      display: inline-flex; align-items: center; gap: 8px;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #c8c6c5;
      text-decoration: none; margin-bottom: 16px; transition: color 0.15s;
    }
    .back-link:hover { color: #caf300; }

    .summary-strip {
      display: flex; gap: 24px; flex-wrap: wrap; padding: 16px;
      background: #1c1b1b; border: 1px solid #353534; margin-bottom: 16px;
    }
    .summary-item { display: flex; flex-direction: column; gap: 4px; }
    .summary-label {
      font-family: var(--font-mono); font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #c8c6c5;
    }
    .summary-value { font-family: var(--font-mono); font-size: 14px; color: #e5e2e1; }

    .detail-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 1024px) { .detail-panels { grid-template-columns: 1fr; } }

    .detail-panel { background: #1c1b1b; border: 1px solid #353534; }
    .panel-header { padding: 16px; border-bottom: 1px solid #353534; }
    .panel-title {
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #e5e2e1;
    }
    .panel-body { padding: 0; }

    .info-grid { padding: 16px; }
    .info-row {
      display: flex; justify-content: space-between; padding: 8px 0;
      border-bottom: 1px solid #2a2a29; gap: 16px;
    }
    .info-row--column { flex-direction: column; gap: 8px; }
    .info-row:last-child { border-bottom: none; }
    .info-row-divider { height: 1px; background: #353534; margin: 8px 0; }
    .info-label {
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #c8c6c5; flex-shrink: 0;
    }
    .info-value { font-family: var(--font-mono); font-size: 12px; color: #e5e2e1; text-align: right; }
    .info-value--block { text-align: left; word-break: break-word; max-width: 300px; }

    .status-badge {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px;
      font-family: var(--font-mono); font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid;
    }
    .status-dot { width: 6px; height: 6px; }
    .status-badge--open { border-color: #ffb300; background: rgba(255,179,0,0.1); color: #ffb300; }
    .status-badge--open .status-dot { background: #ffb300; }
    .status-badge--resolved { border-color: #caf300; background: rgba(202,243,0,0.1); color: #caf300; }
    .status-badge--resolved .status-dot { background: #caf300; }
    .status-badge--ignored { border-color: #555; background: rgba(85,85,85,0.1); color: #888; }
    .status-badge--ignored .status-dot { background: #888; }

    .severity-badge {
      display: inline-block; padding: 2px 6px; font-family: var(--font-mono);
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid;
    }
    .severity-badge--critical { border-color: #ff4b4b; color: #ff4b4b; background: rgba(255,75,75,0.1); }
    .severity-badge--high { border-color: #ff6b35; color: #ff6b35; background: rgba(255,107,53,0.1); }
    .severity-badge--medium { border-color: #ffb300; color: #ffb300; background: rgba(255,179,0,0.1); }
    .severity-badge--low { border-color: #c8c6c5; color: #c8c6c5; background: rgba(200,198,197,0.1); }

    .actions-grid { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
    .action-buttons { display: flex; flex-direction: column; gap: 8px; }
    .action-btn {
      display: flex; align-items: center; gap: 10px; padding: 12px 16px;
      background: none; border: 1px solid #353534; color: #e5e2e1;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer;
      transition: all 0.15s; text-align: left;
    }
    .action-btn--resolve:hover { border-color: #caf300; color: #caf300; }

    .action-form { display: flex; flex-direction: column; gap: 12px; }
    .action-form-title {
      font-family: var(--font-mono); font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #caf300;
    }
    .form-field { display: flex; flex-direction: column; gap: 4px; }
    .form-label {
      font-family: var(--font-mono); font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #c8c6c5;
    }
    .form-textarea {
      background: #0e0e0e; border: 1px solid #353534; color: #e5e2e1;
      padding: 10px 12px; font-family: var(--font-mono); font-size: 12px;
      outline: none; transition: border-color 0.15s; resize: vertical;
    }
    .form-textarea:focus { border-color: #caf300; }
    .form-textarea::placeholder { color: #555; }

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
      display: flex; align-items: center; gap: 12px; padding: 16px;
      border: 1px solid #caf300; background: rgba(202,243,0,0.05);
    }
    .success-icon { font-size: 24px; color: #caf300; }
    .success-text { font-family: var(--font-mono); font-size: 12px; color: #caf300; }

    .action-error {
      display: flex; align-items: center; gap: 12px; padding: 16px;
      border: 1px solid #ff4b4b; background: rgba(255,75,75,0.05);
    }
    .error-action-icon { font-size: 24px; color: #ff4b4b; }
    .error-action-text { font-family: var(--font-mono); font-size: 12px; color: #ff4b4b; }

    .resolved-notice {
      display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px;
    }
    .resolved-text {
      font-family: var(--font-mono); font-size: 12px; color: #c8c6c5;
      text-transform: uppercase; letter-spacing: 0.05em;
    }

    .skeleton-label { height: 12px; background: #2a2a29; animation: pulse 1.5s infinite ease-in-out; }
    .skeleton-value { height: 24px; background: #2a2a29; margin-top: 8px; animation: pulse 1.5s infinite ease-in-out; }
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
    }
    .retry-btn:hover { background: #ff4b4b; color: #000; }
  `,
})
export class AdminDataQualityDetailPage implements OnInit {
  @Input({ required: true }) id!: string;

  private readonly api = inject(AdminApiService);

  readonly state = signal<LoadState>('loading');
  readonly issue = signal<AdminDataQualityIssueDetailResponse | null>(null);
  readonly errorMessage = signal('');
  readonly showResolveForm = signal(false);
  readonly isSubmitting = signal(false);
  readonly actionSuccess = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  resolveReason = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');

    this.api.getDataQualityIssue(this.id).subscribe({
      next: (data) => {
        this.issue.set(data);
        this.state.set('loaded');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? `HTTP ${err.status}`);
        this.state.set('error');
      },
    });
  }

  submitResolve(): void {
    if (!this.resolveReason.trim()) return;

    this.isSubmitting.set(true);
    this.actionError.set(null);

    this.api.resolveDataQualityIssue(this.id, {
      reason: this.resolveReason.trim(),
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.actionSuccess.set('Issue resolved successfully.');
        this.showResolveForm.set(false);
        this.load();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.actionError.set(err?.error?.error ?? `HTTP ${err.status}: Resolve failed`);
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
