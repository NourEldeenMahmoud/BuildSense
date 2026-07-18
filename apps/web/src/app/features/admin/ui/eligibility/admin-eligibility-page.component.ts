import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/services/admin-api.service';
import { CatalogService } from '../../../catalog/data-access/catalog.service';
import type {
  AdminEligibilityOverrideListItem,
  AdminPagination,
} from '@buildsense/contracts';
import type { CatalogProductListItem } from '../../../../shared/contracts/catalog';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-admin-eligibility',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Page intro -->
    <div class="page-intro">
      <p class="page-intro-text">Set product eligibility for the PC builder. Override changes are audited with admin identity and reason. History below reflects all prior overrides.</p>
    </div>

    <!-- Override action panel -->
    <div class="action-panel">
      <div class="action-panel-header">
        <h3 class="action-panel-title">NEW OVERRIDE // Set Product Eligibility</h3>
      </div>
      <div class="action-panel-body">
        <div class="action-row">
          <div class="form-field form-field--wide">
            <label class="form-label">SEARCH PRODUCT *</label>
            <input
              class="form-input"
              type="text"
              placeholder="Search product title, brand, or model..."
              [(ngModel)]="productSearchQuery"
              (input)="onProductSearch()"
            />
          </div>
          <div class="form-field">
            <label class="form-label">ELIGIBILITY *</label>
            <select class="form-select" [(ngModel)]="eligibilityValue">
              <option value="">SELECT</option>
              <option value="ELIGIBLE">ELIGIBLE</option>
              <option value="NOT_ELIGIBLE">NOT ELIGIBLE</option>
            </select>
          </div>
        </div>
        @if (productSearchResults().length > 0) {
          <div class="product-results">
            @for (product of productSearchResults(); track product.id) {
              <button
                class="product-result"
                [class.selected]="selectedProductId() === product.id"
                (click)="selectProduct(product)"
              >
                <span class="product-result-title">{{ product.title }}</span>
                <span class="product-result-meta">{{ product.category }} @if (product.brand) { | {{ product.brand }} }</span>
              </button>
            }
          </div>
        }
        @if (selectedProduct()) {
          <div class="selected-product">
            <span class="selected-product-label">SELECTED:</span>
            <span class="selected-product-title">{{ selectedProduct()!.title }}</span>
            <span class="selected-product-meta">{{ selectedProduct()!.category }}</span>
          </div>
        }
        <div class="form-field">
          <label class="form-label">REASON *</label>
          <textarea
            class="form-textarea"
            [(ngModel)]="overrideReason"
            placeholder="Why is this eligibility change being made?"
            rows="2"
          ></textarea>
        </div>
        <div class="form-actions">
          <button
            class="form-btn form-btn--submit"
            [disabled]="!selectedProductId() || !eligibilityValue || !overrideReason.trim() || isSubmitting()"
            (click)="submitOverride()"
          >
            @if (isSubmitting()) { SUBMITTING... } @else { APPLY OVERRIDE }
          </button>
        </div>
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
    </div>

    <!-- Override history -->
    <div class="section-header">
      <h3 class="section-title">OVERRIDE HISTORY</h3>
      <span class="section-count">{{ pagination()?.totalItems ?? 0 }} total</span>
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
        <h3 class="error-title">Failed to load overrides</h3>
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
        <span class="material-symbols-outlined empty-icon">history</span>
        <h3 class="empty-title">No overrides yet</h3>
        <p class="empty-message">Override history will appear here.</p>
      </div>
    }

    <!-- Override history table -->
    @if (state() === 'loaded' && items().length > 0) {
      <div class="table-panel">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="data-th">PRODUCT ID</th>
                <th class="data-th">PREVIOUS</th>
                <th class="data-th">NEW</th>
                <th class="data-th">ADMIN</th>
                <th class="data-th">REASON</th>
                <th class="data-th">CREATED</th>
              </tr>
            </thead>
            <tbody>
              @for (override of items(); track override.id) {
                <tr class="data-tr">
                  <td class="data-td data-td--mono">{{ override.productId }}</td>
                  <td class="data-td">
                    <span class="eligibility-tag" [class]="'eligibility-tag--' + override.previousEligibility.toLowerCase()">
                      {{ override.previousEligibility }}
                    </span>
                  </td>
                  <td class="data-td">
                    <span class="eligibility-tag" [class]="'eligibility-tag--' + override.newEligibility.toLowerCase()">
                      {{ override.newEligibility }}
                    </span>
                  </td>
                  <td class="data-td data-td--mono">{{ override.adminId }}</td>
                  <td class="data-td data-td--reason">{{ override.reason }}</td>
                  <td class="data-td data-td--mono">{{ formatDate(override.createdAt) }}</td>
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

    /* ── Page intro ───────────────────────────────────────────────── */
    .page-intro {
      margin-bottom: 16px; padding: 12px 16px;
      background: #1c1b1b; border: 1px solid #353534;
    }
    .page-intro-text {
      font-family: var(--font-mono); font-size: 12px; color: #c8c6c5;
      line-height: 1.6; letter-spacing: 0.02em;
    }

    /* ── Action panel ──────────────────────────────────────────────── */
    .action-panel {
      background: #131313; border: 1px solid #353534; margin-bottom: 16px;
    }
    .action-panel-header {
      padding: 12px 16px; border-bottom: 1px solid #353534;
      background: #1c1b1b;
    }
    .action-panel-title {
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #caf300;
    }
    .action-panel-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

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
    .form-select { cursor: pointer; }

    .product-results {
      display: flex; flex-direction: column; border: 1px solid #353534;
      max-height: 200px; overflow-y: auto;
    }
    .product-result {
      display: flex; flex-direction: column; gap: 2px; padding: 8px 12px;
      background: none; border: none; border-bottom: 1px solid #2a2a29;
      text-align: left; cursor: pointer; transition: background 0.1s;
    }
    .product-result:hover { background: #20201f; }
    .product-result.selected { background: #2a2a29; border-left: 2px solid #caf300; }
    .product-result-title { font-family: var(--font-primary); font-size: 13px; color: #e5e2e1; }
    .product-result-meta { font-family: var(--font-mono); font-size: 10px; color: #c8c6c5; }

    .selected-product {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: rgba(202,243,0,0.05); border: 1px solid #caf300;
    }
    .selected-product-label {
      font-family: var(--font-mono); font-size: 10px; font-weight: 700;
      text-transform: uppercase; color: #caf300;
    }
    .selected-product-title {
      font-family: var(--font-primary); font-size: 13px; color: #e5e2e1;
    }
    .selected-product-meta {
      font-family: var(--font-mono); font-size: 10px; color: #c8c6c5;
    }

    .form-actions { display: flex; gap: 8px; }
    .form-btn {
      padding: 10px 20px; font-family: var(--font-mono); font-size: 11px;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      cursor: pointer; transition: all 0.15s; border: 1px solid;
    }
    .form-btn--submit { background: #caf300; border-color: #caf300; color: #000; }
    .form-btn--submit:hover:not(:disabled) { background: #b0d500; }
    .form-btn--submit:disabled { opacity: 0.5; cursor: not-allowed; }

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

    /* ── Section header ────────────────────────────────────────────── */
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .section-title {
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: #e5e2e1;
    }
    .section-count {
      font-family: var(--font-mono); font-size: 11px; color: #c8c6c5;
      text-transform: uppercase; letter-spacing: 0.05em;
    }

    /* ── Table ─────────────────────────────────────────────────────── */
    .table-panel {
      background: #131313; border: 1px solid #353534;
      display: flex; flex-direction: column;
    }
    .table-wrapper { overflow-x: auto; width: 100%; }
    .data-table { width: 100%; border-collapse: collapse; min-width: 800px; }
    .data-th {
      padding: 8px 16px; font-family: var(--font-mono); font-size: 11px;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      color: #c8c6c5; text-align: left; border-bottom: 1px solid #353534;
      background: #20201f;
    }
    .data-tr { border-bottom: 1px solid #2a2a29; transition: background 0.1s; }
    .data-tr:hover { background: #1c1b1b; }
    .data-td {
      padding: 12px 16px; font-family: var(--font-mono); font-size: 12px;
      color: #e5e2e1; letter-spacing: 0.02em; white-space: nowrap;
    }
    .data-td--mono { font-variant-numeric: tabular-nums; }
    .data-td--reason { max-width: 250px; overflow: hidden; text-overflow: ellipsis; }

    .eligibility-tag {
      display: inline-block; padding: 2px 6px; font-family: var(--font-mono);
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; border: 1px solid;
    }
    .eligibility-tag--eligible { border-color: #caf300; color: #caf300; background: rgba(202,243,0,0.1); }
    .eligibility-tag--not_eligible { border-color: #ff4b4b; color: #ff4b4b; background: rgba(255,75,75,0.1); }

    .pagination {
      display: flex; align-items: center; justify-content: center; gap: 16px;
      padding: 12px 16px; border-top: 1px solid #353534;
      background: #0e0e0e;
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
  `,
})
export class AdminEligibilityPage implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly catalog = inject(CatalogService);

  readonly state = signal<LoadState>('loading');
  readonly items = signal<AdminEligibilityOverrideListItem[]>([]);
  readonly pagination = signal<AdminPagination | null>(null);
  readonly errorMessage = signal('');
  readonly isSubmitting = signal(false);
  readonly actionSuccess = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  // Product search
  productSearchQuery = '';
  readonly productSearchResults = signal<CatalogProductListItem[]>([]);
  readonly selectedProductId = signal<string | null>(null);
  readonly selectedProduct = signal<CatalogProductListItem | null>(null);
  eligibilityValue = '';
  overrideReason = '';

  private currentPage = 1;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');

    this.api.getEligibilityOverrides({
      page: String(this.currentPage),
      pageSize: '20',
    }).subscribe({
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

  onProductSearch(): void {
    const query = this.productSearchQuery.trim();
    if (query.length < 2) {
      this.productSearchResults.set([]);
      return;
    }
    this.catalog.getProducts({ search: query, pageSize: 8 }).subscribe({
      next: (data) => this.productSearchResults.set(data.items),
      error: () => this.productSearchResults.set([]),
    });
  }

  selectProduct(product: CatalogProductListItem): void {
    this.selectedProductId.set(product.id);
    this.selectedProduct.set(product);
    this.productSearchQuery = product.title;
    this.productSearchResults.set([]);
  }

  submitOverride(): void {
    const productId = this.selectedProductId();
    if (!productId || !this.eligibilityValue || !this.overrideReason.trim()) return;

    this.isSubmitting.set(true);
    this.actionError.set(null);

    this.api.overrideEligibility(productId, {
      eligibility: this.eligibilityValue as 'ELIGIBLE' | 'NOT_ELIGIBLE',
      reason: this.overrideReason.trim(),
    }).subscribe({
      next: (resp) => {
        this.isSubmitting.set(false);
        this.actionSuccess.set(
          `Eligibility changed from ${resp.previousEligibility} to ${resp.newEligibility}.`
        );
        this.resetForm();
        this.load();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.actionError.set(err?.error?.error ?? `HTTP ${err.status}: Override failed`);
      },
    });
  }

  private resetForm(): void {
    this.productSearchQuery = '';
    this.productSearchResults.set([]);
    this.selectedProductId.set(null);
    this.selectedProduct.set(null);
    this.eligibilityValue = '';
    this.overrideReason = '';
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
