import { Component, OnChanges, SimpleChanges, output, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OverlayComponent } from '../../../shared/components/overlay.component';
import { CompareCandidateSearchService } from '../data-access/compare-candidate-search.service';
import type { CatalogProductListItem } from '../../../shared/contracts/catalog';

@Component({
  selector: 'bs-compare-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayComponent],
  providers: [CompareCandidateSearchService],
  inputs: ['isOpen', 'category', 'currentProductId', 'currentProductTitle', 'targetSide'],
  template: `
    <app-overlay
      [isOpen]="isOpen"
      [ariaLabel]="'Select product to compare with ' + (currentProductTitle || 'current product')"
      [title]="'Select Product B'"
      [closeOnBackdropClick]="true"
      (isOpenChange)="onOverlayClose($event)">

      <!-- Search input -->
      <div class="selector-search">
        <input
          #searchInput
          type="text"
          class="input-field selector-search-input"
          placeholder="Search products in same category…"
          [attr.aria-label]="'Search ' + category + ' products'"
          [ngModel]="searchQuery()"
          (ngModelChange)="onSearchInput($event)"
        />
      </div>

      <!-- Loading state -->
      @if (candidateService.loading()) {
        <div class="selector-loading" role="status" aria-label="Searching products">
          <div class="selector-spinner" aria-hidden="true"></div>
          <span class="selector-loading-text tech-font">Searching…</span>
        </div>
      }

      <!-- Error state -->
      @if (candidateService.error()) {
        <div class="selector-error" role="alert">
          <p class="selector-error-text tech-font">{{ candidateService.error() }}</p>
          <button
            class="btn btn-secondary selector-retry-btn"
            (click)="retrySearch()"
            aria-label="Retry search">
            Retry
          </button>
        </div>
      }

      <!-- Empty state -->
      @if (!candidateService.loading() && !candidateService.error() && candidateService.items().length === 0 && searchQuery()) {
        <div class="selector-empty" role="status">
          <p class="selector-empty-text tech-font">No products found matching your search.</p>
        </div>
      }

      <!-- Initial state (no search yet) -->
      @if (!candidateService.loading() && !candidateService.error() && candidateService.items().length === 0 && !searchQuery()) {
        <div class="selector-empty" role="status">
          <p class="selector-empty-text tech-font">Type to search for {{ category }} products to compare.</p>
        </div>
      }

      <!-- Results list -->
      @if (candidateService.items().length > 0) {
        <div class="selector-results" role="listbox" [attr.aria-label]="'Available ' + category + ' products'">
          @for (product of candidateService.items(); track product.id) {
            <button
              class="selector-result-item"
              role="option"
              [attr.aria-label]="product.title + (product.brand ? ' by ' + product.brand : '')"
              (click)="selectProduct(product)">
              <div class="result-image">
                @if (product.images && product.images.length > 0) {
                  <img [src]="product.images[0]" [alt]="product.title" class="result-thumb" loading="lazy" />
                } @else {
                  <div class="result-thumb-fallback" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                }
              </div>
              <div class="result-info">
                <span class="result-title">{{ product.title }}</span>
                @if (product.brand) {
                  <span class="result-brand tech-font">{{ product.brand }}</span>
                }
                @if (product.price !== null && product.price >= 0) {
                  <span class="result-price tech-font">{{ product.price | number:'1.0-0' }} {{ product.currency }}</span>
                } @else {
                  <span class="result-price tech-font">\u2014</span>
                }
              </div>
              <div class="result-select">
                <span class="result-select-label tech-font">Select</span>
              </div>
            </button>
          }
        </div>

        <!-- Pagination -->
        @if (candidateService.totalPages() > 1) {
          <nav class="selector-pagination" aria-label="Search results pages">
            <button
              class="pagination-btn tech-font"
              [disabled]="!candidateService.hasPrevPage()"
              (click)="goToPage(candidateService.page() - 1)"
              aria-label="Previous page">
              ‹ Prev
            </button>
            <span class="pagination-info tech-font">
              Page {{ candidateService.page() }} of {{ candidateService.totalPages() }}
            </span>
            <button
              class="pagination-btn tech-font"
              [disabled]="!candidateService.hasNextPage()"
              (click)="goToPage(candidateService.page() + 1)"
              aria-label="Next page">
              Next ›
            </button>
          </nav>
        }
      }
    </app-overlay>
  `,
  styles: [`
    .selector-search {
      margin-bottom: var(--space-gutter);
    }
    .selector-search-input {
      width: 100%;
    }
    .selector-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: var(--space-gutter);
    }
    .selector-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--color-surface-container-high);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .selector-loading-text {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    .selector-error {
      padding: var(--space-gutter);
      text-align: center;
    }
    .selector-error-text {
      font-size: 13px;
      color: var(--color-error);
      margin-bottom: var(--space-base);
    }
    .selector-retry-btn {
      font-size: 12px;
      padding: 8px 16px;
    }
    .selector-empty {
      padding: var(--space-gutter);
      text-align: center;
    }
    .selector-empty-text {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    .selector-results {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .selector-result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: transparent;
      border: none;
      border-bottom: var(--border-width) solid var(--color-border);
      cursor: pointer;
      text-align: left;
      width: 100%;
      color: var(--color-on-surface);
      transition: background-color 0.15s;
    }
    .selector-result-item:hover {
      background-color: var(--color-surface-container);
    }
    .selector-result-item:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }
    .selector-result-item:last-child {
      border-bottom: none;
    }
    .result-image {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
      background: var(--color-surface-container);
      border: var(--border-width) solid var(--color-border);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .result-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .result-thumb-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-on-surface-variant);
      opacity: 0.4;
    }
    .result-thumb-fallback svg {
      width: 24px;
      height: 24px;
    }
    .result-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .result-title {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .result-brand {
      font-size: 11px;
      color: var(--color-on-surface-variant);
    }
    .result-price {
      font-size: 12px;
      color: var(--color-on-surface-variant);
    }
    .result-select {
      flex-shrink: 0;
    }
    .result-select-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-primary);
    }
    .selector-pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-gutter);
      padding: var(--space-base) 0;
      margin-top: var(--space-base);
      border-top: var(--border-width) solid var(--color-border);
    }
    .pagination-btn {
      background: transparent;
      border: var(--border-width) solid var(--color-on-surface);
      color: var(--color-on-surface);
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }
    .pagination-btn:hover:not(:disabled) {
      background-color: var(--color-surface-container-high);
    }
    .pagination-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    .pagination-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .pagination-info {
      font-size: 12px;
      color: var(--color-on-surface-variant);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-primary);
      font-weight: 600;
      border-radius: var(--radius-none);
      border: var(--border-width) solid transparent;
      padding: 12px 24px;
      cursor: pointer;
      transition: all 0.2s ease-in-out;
      text-transform: uppercase;
      font-size: 14px;
      letter-spacing: 0.05em;
    }
    .btn-secondary {
      background-color: transparent;
      border-color: var(--color-on-surface);
      color: var(--color-on-surface);
      font-family: var(--font-mono);
    }
    .btn-secondary:hover {
      background-color: var(--color-surface-container-high);
    }
  `],
})
export class CompareSelectorComponent implements OnDestroy, OnChanges {
  readonly candidateService = inject(CompareCandidateSearchService);

  isOpen = false;
  category = '';
  currentProductId = '';
  currentProductTitle = '';
  targetSide: 'left' | 'right' = 'right';

  productSelected = output<{ side: 'left' | 'right'; product: CatalogProductListItem }>();
  closed = output<void>();

  searchQuery = signal('');
  private lastSearchedQuery = '';
  private pageSize = 12;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] || changes['category'] || changes['currentProductId']) {
      const open = this.isOpen;
      const cat = this.category;
      const excludeId = this.currentProductId;
      if (open && cat && excludeId) {
        this.candidateService.reset();
        this.searchQuery.set('');
        this.lastSearchedQuery = '';
        // Initial load of all products in category
        this.candidateService.search(cat, '', 1, this.pageSize, excludeId);
      }
    }
  }

  ngOnDestroy(): void {
    this.candidateService.reset();
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    if (query !== this.lastSearchedQuery) {
      this.lastSearchedQuery = query;
      this.candidateService.search(
        this.category,
        query,
        1,
        this.pageSize,
        this.currentProductId
      );
    }
  }

  selectProduct(product: CatalogProductListItem): void {
    this.productSelected.emit({ side: this.targetSide, product });
  }

  goToPage(page: number): void {
    this.candidateService.search(
      this.category,
      this.searchQuery(),
      page,
      this.pageSize,
      this.currentProductId
    );
  }

  retrySearch(): void {
    this.candidateService.search(
      this.category,
      this.searchQuery(),
      this.candidateService.page() || 1,
      this.pageSize,
      this.currentProductId
    );
  }

  onOverlayClose(isOpen: boolean): void {
    if (!isOpen) {
      this.closed.emit();
    }
  }
}
