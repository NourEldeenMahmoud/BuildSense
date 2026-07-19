import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/services/admin-api.service';
import { CatalogService } from '../../../catalog/data-access/catalog.service';
import type {
  AdminMatchReviewDetailResponse,
} from '@buildsense/contracts';
import type { CatalogProductListItem } from '../../../../shared/contracts/catalog';

type LoadState = 'loading' | 'loaded' | 'error';
type ActionType = 'link' | 'create' | 'ignore' | null;

@Component({
  selector: 'app-admin-match-review-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <!-- Back link -->
    <a class="back-link" routerLink="/admin/match-reviews">
      <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
      MATCH REVIEWS
    </a>

    <!-- Loading skeleton -->
    @if (state() === 'loading') {
      <div class="detail-skeleton">
        <div class="skeleton-row" style="height:48px;width:100%"></div>
        <div class="skeleton-row" style="height:200px;width:100%"></div>
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

    <!-- Detail panels -->
    @if (state() === 'loaded' && review()) {
      <!-- Header strip -->
      <div class="detail-header">
        <div class="detail-header__left">
          <span class="detail-header__label">REVIEW TASK</span>
          <span class="detail-header__id">
            <span class="detail-header__dot"></span>
            {{ review()!.id }}
          </span>
        </div>
        <h1 class="detail-header__title">Determine Canonical Linkage</h1>
        <div class="detail-header__right">
          <span class="detail-header__meta">
            <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>
            {{ formatDate(review()!.createdAt) }}
          </span>
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="detail-columns">
        <!-- LEFT: Source Listing -->
        <div class="detail-col">
          <div class="source-panel">
            <div class="panel-header">
              <span class="panel-header__label">SOURCE LISTING (SCRAPED)</span>
              <span class="material-symbols-outlined panel-header__icon">input</span>
            </div>
            <div class="panel-body">
              <!-- Source identity -->
              <div class="source-identity">
                <div class="source-identity__info">
                  <h2 class="source-identity__name">{{ review()!.storeCode }}</h2>
                  <div class="source-identity__url">
                    <span class="material-symbols-outlined" style="font-size:12px;">link</span>
                    {{ truncateUrl(review()!.canonicalUrl) }}
                  </div>
                </div>
              </div>

              <!-- Extracted identity fields -->
              <div class="identity-fields">
                <h3 class="section-title">EXTRACTED IDENTITY FIELDS</h3>
                <table class="fields-table">
                  <tbody>
                    <tr class="fields-row">
                      <td class="fields-key">STORE</td>
                      <td class="fields-val">{{ review()!.storeCode }}</td>
                    </tr>
                    <tr class="fields-row">
                      <td class="fields-key">URL</td>
                      <td class="fields-val fields-val--url">{{ review()!.canonicalUrl }}</td>
                    </tr>
                    <tr class="fields-row">
                      <td class="fields-key">FLAG REASON</td>
                      <td class="fields-val fields-val--block">{{ review()!.flagReason }}</td>
                    </tr>
                    @if (review()!.suggestedCategory) {
                      <tr class="fields-row">
                        <td class="fields-key">SUGGESTED CATEGORY</td>
                        <td class="fields-val">{{ review()!.suggestedCategory }}</td>
                      </tr>
                    }
                    <tr class="fields-row">
                      <td class="fields-key">RAW SNAPSHOT</td>
                      <td class="fields-val">{{ review()!.rawSnapshotId }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: Candidate / Resolution -->
        <div class="detail-col">
          <div class="candidate-panel">
            <div class="panel-header panel-header--accent">
              <span class="panel-header__label panel-header__label--accent">CANDIDATE / RESOLUTION</span>
              <span class="panel-header__status">
                <span class="status-badge" [class]="'status-badge--' + review()!.status.toLowerCase()">
                  <span class="status-dot"></span>
                  {{ review()!.status }}
                </span>
              </span>
            </div>
            <div class="panel-body">
              @if (review()!.resolvedAt) {
                <!-- Resolved state -->
                <div class="resolution-info">
                  <div class="resolution-field">
                    <span class="info-label">RESOLVED BY</span>
                    <span class="info-value">{{ review()!.resolvedBy ?? '—' }}</span>
                  </div>
                  <div class="resolution-field">
                    <span class="info-label">RESOLUTION</span>
                    <span class="info-value info-value--block">{{ review()!.resolutionReason ?? '—' }}</span>
                  </div>
                  <div class="resolution-field">
                    <span class="info-label">RESOLVED AT</span>
                    <span class="info-value">{{ formatDate(review()!.resolvedAt) }}</span>
                  </div>
                  @if (review()!.linkedProductId) {
                    <div class="resolution-field">
                      <span class="info-label">LINKED PRODUCT</span>
                      <span class="info-value info-value--accent">{{ review()!.linkedProductId }}</span>
                    </div>
                  }
                  @if (review()!.createdProductId) {
                    <div class="resolution-field">
                      <span class="info-label">CREATED PRODUCT</span>
                      <span class="info-value info-value--accent">{{ review()!.createdProductId }}</span>
                    </div>
                  }
                </div>
              } @else {
                <!-- Unresolved: actions -->
                <div class="action-section">
                  @if (!activeAction()) {
                    <div class="action-buttons">
                      <button class="action-btn action-btn--link" (click)="setAction('link')">
                        <span class="material-symbols-outlined" style="font-size:18px;">link</span>
                        LINK TO PRODUCT
                      </button>
                      <button class="action-btn action-btn--create" (click)="setAction('create')">
                        <span class="material-symbols-outlined" style="font-size:18px;">add_box</span>
                        CREATE PRODUCT
                      </button>
                      <button class="action-btn action-btn--ignore" (click)="setAction('ignore')">
                        <span class="material-symbols-outlined" style="font-size:18px;">block</span>
                        IGNORE
                      </button>
                    </div>
                  }

                  <!-- Link form -->
                  @if (activeAction() === 'link') {
                    <div class="action-form">
                      <h4 class="action-form__title">LINK TO EXISTING PRODUCT</h4>
                      <div class="form-field">
                        <label class="form-label">SEARCH CATALOG</label>
                        <input
                          class="form-input"
                          type="text"
                          placeholder="Search product title, brand, or model..."
                          [(ngModel)]="productSearchQuery"
                          (input)="onProductSearch()"
                        />
                      </div>
                      @if (productSearchResults().length > 0) {
                        <div class="product-results">
                          @for (product of productSearchResults(); track product.id) {
                            <button
                              class="product-result"
                              [class.selected]="selectedProductId() === product.id"
                              (click)="selectProduct(product)"
                            >
                              <span class="product-result__title">{{ product.title }}</span>
                              <span class="product-result__meta">{{ product.category }} @if (product.brand) { | {{ product.brand }} }</span>
                            </button>
                          }
                        </div>
                      }
                      <div class="form-field">
                        <label class="form-label">AUDIT NOTE (REQUIRED)</label>
                        <textarea
                          class="form-textarea"
                          [(ngModel)]="actionReason"
                          placeholder="Enter justification for linkage..."
                          rows="3"
                        ></textarea>
                      </div>
                      <div class="form-actions">
                        <button
                          class="form-btn form-btn--submit"
                          [disabled]="!selectedProductId() || !actionReason.trim() || isSubmitting()"
                          (click)="submitLink()"
                        >
                          @if (isSubmitting()) { SUBMITTING... } @else { CONFIRM LINK }
                        </button>
                        <button class="form-btn form-btn--cancel" (click)="cancelAction()">CANCEL</button>
                      </div>
                    </div>
                  }

                  <!-- Create form -->
                  @if (activeAction() === 'create') {
                    <div class="action-form">
                      <h4 class="action-form__title">CREATE NEW CANONICAL</h4>
                      <div class="form-field">
                        <label class="form-label">TITLE *</label>
                        <input class="form-input" type="text" [(ngModel)]="createTitle" placeholder="Product title" />
                      </div>
                      <div class="form-field">
                        <label class="form-label">CATEGORY *</label>
                        <input class="form-input" type="text" [(ngModel)]="createCategory" placeholder="e.g. GPU, CPU, Motherboard" />
                      </div>
                      <div class="form-field">
                        <label class="form-label">BRAND</label>
                        <input class="form-input" type="text" [(ngModel)]="createBrand" placeholder="Optional brand name" />
                      </div>
                      <div class="form-field">
                        <label class="form-label">AUDIT NOTE (REQUIRED)</label>
                        <textarea
                          class="form-textarea"
                          [(ngModel)]="actionReason"
                          placeholder="Enter justification for creation..."
                          rows="3"
                        ></textarea>
                      </div>
                      <div class="form-actions">
                        <button
                          class="form-btn form-btn--submit"
                          [disabled]="!createTitle.trim() || !createCategory.trim() || !actionReason.trim() || isSubmitting()"
                          (click)="submitCreate()"
                        >
                          @if (isSubmitting()) { SUBMITTING... } @else { CONFIRM CREATE }
                        </button>
                        <button class="form-btn form-btn--cancel" (click)="cancelAction()">CANCEL</button>
                      </div>
                    </div>
                  }

                  <!-- Ignore form -->
                  @if (activeAction() === 'ignore') {
                    <div class="action-form">
                      <h4 class="action-form__title">IGNORE THIS REVIEW</h4>
                      <p class="action-form__desc">
                        This match flag will be dismissed without linking or creating a product.
                      </p>
                      <div class="form-field">
                        <label class="form-label">AUDIT NOTE (REQUIRED)</label>
                        <textarea
                          class="form-textarea"
                          [(ngModel)]="actionReason"
                          placeholder="Enter justification for ignoring..."
                          rows="3"
                        ></textarea>
                      </div>
                      <div class="form-actions">
                        <button
                          class="form-btn form-btn--submit form-btn--danger"
                          [disabled]="!actionReason.trim() || isSubmitting()"
                          (click)="submitIgnore()"
                        >
                          @if (isSubmitting()) { SUBMITTING... } @else { CONFIRM IGNORE }
                        </button>
                        <button class="form-btn form-btn--cancel" (click)="cancelAction()">CANCEL</button>
                      </div>
                    </div>
                  }

                  <!-- Success state -->
                  @if (actionSuccess()) {
                    <div class="action-success">
                      <span class="material-symbols-outlined action-success__icon">check_circle</span>
                      <p class="action-success__text">{{ actionSuccess() }}</p>
                    </div>
                  }

                  <!-- Error state -->
                  @if (actionError()) {
                    <div class="action-error">
                      <span class="material-symbols-outlined action-error__icon">error</span>
                      <p class="action-error__text">{{ actionError() }}</p>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>
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

    .detail-header {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 16px;
      background: #1c1b1b;
      border: 1px solid #353534;
      border-bottom: 1px solid #caf300;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .detail-header__left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .detail-header__label {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
    }
    .detail-header__id {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #e5e2e1;
      background: #20201f;
      border: 1px solid #353534;
      padding: 2px 8px;
    }
    .detail-header__dot {
      width: 6px;
      height: 6px;
      background: #caf300;
    }
    .detail-header__title {
      font-family: var(--font-primary);
      font-size: 20px;
      font-weight: 600;
      color: #e5e2e1;
      flex: 1;
    }
    .detail-header__right { margin-left: auto; }
    .detail-header__meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #c8c6c5;
    }

    .detail-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 1024px) {
      .detail-columns { grid-template-columns: 1fr; }
    }

    .source-panel, .candidate-panel {
      background: #131313;
      border: 1px solid #353534;
      display: flex;
      flex-direction: column;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: #1c1b1b;
      border-bottom: 1px solid #353534;
    }
    .panel-header--accent {
      background: #20201f;
      border-bottom-color: #caf300;
    }
    .panel-header__label {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
    }
    .panel-header__label--accent { color: #caf300; }
    .panel-header__icon { font-size: 16px; color: #c8c6c5; }
    .panel-body { padding: 0; }

    .source-identity {
      padding: 16px;
      border-bottom: 1px solid #2a2a29;
    }
    .source-identity__name {
      font-family: var(--font-primary);
      font-size: 18px;
      font-weight: 600;
      color: #e5e2e1;
      margin-bottom: 8px;
    }
    .source-identity__url {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #caf300;
      word-break: break-all;
    }

    .identity-fields { padding: 16px; }
    .section-title {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #2a2a29;
    }
    .fields-table { width: 100%; border-collapse: collapse; }
    .fields-row {
      border-bottom: 1px solid #2a2a29;
    }
    .fields-row:hover { background: #1c1b1b; }
    .fields-key {
      padding: 8px 0;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
      width: 35%;
      vertical-align: top;
    }
    .fields-val {
      padding: 8px 0;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #e5e2e1;
    }
    .fields-val--url {
      color: #caf300;
      word-break: break-all;
      font-size: 11px;
    }
    .fields-val--block {
      word-break: break-word;
    }

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
    .status-badge--pending { border-color: #ffb300; background: rgba(255,179,0,0.1); color: #ffb300; }
    .status-badge--pending .status-dot { background: #ffb300; }
    .status-badge--linked { border-color: #caf300; background: rgba(202,243,0,0.1); color: #caf300; }
    .status-badge--linked .status-dot { background: #caf300; }
    .status-badge--created_product { border-color: #caf300; background: rgba(202,243,0,0.1); color: #caf300; }
    .status-badge--created_product .status-dot { background: #caf300; }
    .status-badge--ignored { border-color: #555; background: rgba(85,85,85,0.1); color: #888; }
    .status-badge--ignored .status-dot { background: #888; }

    .resolution-info {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .resolution-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .info-label {
      font-family: var(--font-mono);
      font-size: 10px;
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
    .info-value--block { word-break: break-word; }
    .info-value--accent { color: #caf300; }

    .action-section {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .action-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: none;
      border: 1px solid #353534;
      color: #e5e2e1;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: all 0.15s;
      text-align: left;
    }
    .action-btn--link:hover { border-color: #caf300; color: #caf300; }
    .action-btn--create:hover { border-color: #caff33; color: #caff33; }
    .action-btn--ignore:hover { border-color: #ff4b4b; color: #ff4b4b; }

    .action-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .action-form__title {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #caf300;
    }
    .action-form__desc {
      font-family: var(--font-mono);
      font-size: 11px;
      color: #c8c6c5;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-label {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
    }
    .form-input, .form-textarea {
      background: #0e0e0e;
      border: 1px solid #353534;
      color: #e5e2e1;
      padding: 10px 12px;
      font-family: var(--font-mono);
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s;
      resize: vertical;
    }
    .form-input:focus, .form-textarea:focus { border-color: #caf300; }
    .form-input::placeholder, .form-textarea::placeholder { color: #555; }

    .product-results {
      display: flex;
      flex-direction: column;
      border: 1px solid #353534;
      max-height: 200px;
      overflow-y: auto;
    }
    .product-result {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 12px;
      background: none;
      border: none;
      border-bottom: 1px solid #2a2a29;
      text-align: left;
      cursor: pointer;
      transition: background 0.1s;
    }
    .product-result:hover { background: #20201f; }
    .product-result.selected { background: #2a2a29; border-left: 2px solid #caf300; }
    .product-result__title {
      font-family: var(--font-primary);
      font-size: 13px;
      color: #e5e2e1;
    }
    .product-result__meta {
      font-family: var(--font-mono);
      font-size: 10px;
      color: #c8c6c5;
    }

    .form-actions { display: flex; gap: 8px; }
    .form-btn {
      padding: 10px 20px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: all 0.15s;
      border: 1px solid;
    }
    .form-btn--submit {
      background: #caf300;
      border-color: #caf300;
      color: #000;
    }
    .form-btn--submit:hover:not(:disabled) { background: #b0d500; }
    .form-btn--submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .form-btn--danger {
      background: #ff4b4b;
      border-color: #ff4b4b;
      color: #000;
    }
    .form-btn--danger:hover:not(:disabled) { background: #e03030; }
    .form-btn--cancel {
      background: none;
      border-color: #353534;
      color: #c8c6c5;
    }
    .form-btn--cancel:hover { border-color: #c8c6c5; color: #e5e2e1; }

    .action-success {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border: 1px solid #caf300;
      background: rgba(202,243,0,0.05);
    }
    .action-success__icon { font-size: 24px; color: #caf300; }
    .action-success__text {
      font-family: var(--font-mono);
      font-size: 12px;
      color: #caf300;
    }

    .action-error {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border: 1px solid #ff4b4b;
      background: rgba(255,75,75,0.05);
    }
    .action-error__icon { font-size: 24px; color: #ff4b4b; }
    .action-error__text {
      font-family: var(--font-mono);
      font-size: 12px;
      color: #ff4b4b;
    }

    .detail-skeleton { display: flex; flex-direction: column; gap: 16px; }
    .skeleton-row {
      background: #2a2a29;
      animation: pulse 1.5s infinite ease-in-out;
    }
    @keyframes pulse { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }

    .error-title {
      font-family: var(--font-mono); font-size: 14px; font-weight: 700;
      color: #e5e2e1; margin-bottom: 8px; text-transform: uppercase;
      letter-spacing: 0.08em;
    }
  `,
})
export class AdminMatchReviewDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AdminApiService);
  private readonly catalog = inject(CatalogService);

  id = '';
  readonly state = signal<LoadState>('loading');
  readonly review = signal<AdminMatchReviewDetailResponse | null>(null);
  readonly errorMessage = signal('');
  readonly activeAction = signal<ActionType>(null);
  readonly isSubmitting = signal(false);
  readonly actionSuccess = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  // Link form
  productSearchQuery = '';
  readonly productSearchResults = signal<CatalogProductListItem[]>([]);
  readonly selectedProductId = signal<string | null>(null);

  // Create form
  createTitle = '';
  createCategory = '';
  createBrand = '';

  // Common
  actionReason = '';

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');

    this.api.getMatchReview(this.id).subscribe({
      next: (data) => {
        this.review.set(data);
        this.state.set('loaded');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? `HTTP ${err.status}`);
        this.state.set('error');
      },
    });
  }

  setAction(action: ActionType): void {
    this.activeAction.set(action);
    this.actionSuccess.set(null);
    this.actionError.set(null);
    this.actionReason = '';
    this.productSearchQuery = '';
    this.productSearchResults.set([]);
    this.selectedProductId.set(null);
    this.createTitle = '';
    this.createCategory = '';
    this.createBrand = '';
  }

  cancelAction(): void {
    this.activeAction.set(null);
    this.actionError.set(null);
  }

  onProductSearch(): void {
    const query = this.productSearchQuery.trim();
    if (query.length < 2) {
      this.productSearchResults.set([]);
      return;
    }
    this.catalog.getProducts({ search: query, pageSize: 10 }).subscribe({
      next: (data) => this.productSearchResults.set(data.items),
      error: () => this.productSearchResults.set([]),
    });
  }

  selectProduct(product: CatalogProductListItem): void {
    this.selectedProductId.set(product.id);
    this.productSearchQuery = product.title;
    this.productSearchResults.set([]);
  }

  submitLink(): void {
    const productId = this.selectedProductId();
    if (!productId || !this.actionReason.trim()) return;

    this.isSubmitting.set(true);
    this.actionError.set(null);

    this.api.linkMatchReview(this.id, {
      catalogProductId: productId,
      reason: this.actionReason.trim(),
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.actionSuccess.set('Product linked successfully. The match review is now resolved.');
        this.load();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.actionError.set(err?.error?.error ?? `HTTP ${err.status}: Link failed`);
      },
    });
  }

  submitCreate(): void {
    if (!this.createTitle.trim() || !this.createCategory.trim() || !this.actionReason.trim()) return;

    this.isSubmitting.set(true);
    this.actionError.set(null);

    this.api.createProductFromMatchReview(this.id, {
      title: this.createTitle.trim(),
      category: this.createCategory.trim(),
      brand: this.createBrand.trim() || null,
      reason: this.actionReason.trim(),
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.actionSuccess.set('Product created successfully. The match review is now resolved.');
        this.load();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.actionError.set(err?.error?.error ?? `HTTP ${err.status}: Create failed`);
      },
    });
  }

  submitIgnore(): void {
    if (!this.actionReason.trim()) return;

    this.isSubmitting.set(true);
    this.actionError.set(null);

    this.api.ignoreMatchReview(this.id, {
      reason: this.actionReason.trim(),
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.actionSuccess.set('Match review ignored successfully.');
        this.load();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.actionError.set(err?.error?.error ?? `HTTP ${err.status}: Ignore failed`);
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

  truncateUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.hostname + u.pathname;
    } catch {
      return url;
    }
  }
}
