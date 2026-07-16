import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogStore } from '../data-access/catalog.store';
import { CatalogQueryService } from '../data-access/catalog-query.service';

@Component({
  selector: 'app-catalog-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (pagination(); as p) {
      <nav
        class="pagination"
        data-testid="catalog-pagination"
        [attr.aria-label]="'Page ' + p.page + ' of ' + p.totalPages">
        
        <!-- Result status text -->
        <div class="result-status tech-font" data-testid="result-status" aria-live="polite" role="status">
          @if (catalogStore.backgroundLoading()) {
            <span>Updating...</span>
          } @else if (p.totalItems > 0) {
            <span>
              {{ rangeStart() }}–{{ rangeEnd() }} of {{ p.totalItems }} products
            </span>
          } @else {
            <span>0 products</span>
          }
        </div>

        <div class="pagination-controls">
          <!-- Previous -->
          <button
            class="page-btn"
            type="button"
            data-testid="pagination-prev"
            [disabled]="p.page <= 1"
            [attr.aria-disabled]="p.page <= 1"
            aria-label="Previous page"
            (click)="goToPage(p.page - 1)">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <!-- Page numbers (show limited range) -->
          @for (pageNum of pageRange(); track pageNum) {
            @if (pageNum === -1) {
              <span class="page-ellipsis tech-font" aria-hidden="true">…</span>
            } @else {
              <button
                class="page-btn page-number"
                type="button"
                [attr.data-testid]="'page-btn-' + pageNum"
                [class.active]="pageNum === p.page"
                [attr.aria-label]="'Page ' + pageNum"
                [attr.aria-current]="pageNum === p.page ? 'page' : null"
                (click)="goToPage(pageNum)">
                {{ pageNum }}
              </button>
            }
          }

          <!-- Next -->
          <button
            class="page-btn"
            type="button"
            data-testid="pagination-next"
            [disabled]="p.page >= p.totalPages"
            [attr.aria-disabled]="p.page >= p.totalPages"
            aria-label="Next page"
            (click)="goToPage(p.page + 1)">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </nav>
    }
  `,
  styles: [`
    .pagination {
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 48px 0 0;
      border-top: 1px solid rgba(68, 73, 51, 0.2);
      margin-top: 64px;
    }
    .result-status {
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-on-surface-variant);
    }
    .pagination-controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .page-btn {
      min-width: 40px;
      height: 40px;
      padding: 4px 8px;
      background: transparent;
      border: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface-variant);
      font-family: var(--font-mono);
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .page-btn:hover:not(:disabled) {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
    .page-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .page-btn.active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--color-on-primary);
    }
    .page-ellipsis {
      font-size: 13px;
      color: var(--color-on-surface-variant);
      padding: 0 4px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogPaginationComponent {
  readonly catalogStore = inject(CatalogStore);
  private readonly queryService = inject(CatalogQueryService);

  readonly pagination = computed(() => this.catalogStore.result()?.pagination ?? null);

  readonly rangeStart = computed(() => {
    const p = this.pagination();
    if (!p) return 0;
    return (p.page - 1) * p.pageSize + 1;
  });

  readonly rangeEnd = computed(() => {
    const p = this.pagination();
    if (!p) return 0;
    return Math.min(p.page * p.pageSize, p.totalItems);
  });

  readonly pageRange = computed((): number[] => {
    const p = this.pagination();
    if (!p) return [];
    const total = p.totalPages;
    const current = p.page;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: number[] = [1];
    if (current > 3) pages.push(-1); // ellipsis
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push(-1); // ellipsis
    pages.push(total);
    return pages;
  });

  goToPage(page: number): void {
    const p = this.pagination();
    if (!p || page < 1 || page > p.totalPages) return;
    this.queryService.updateFilters({ page });
    // Move focus to the top of results
    setTimeout(() => {
      const el = document.getElementById('catalog-results-top');
      if (el) el.focus();
    });
  }
}
