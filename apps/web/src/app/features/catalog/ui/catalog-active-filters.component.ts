import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogQueryService } from '../data-access/catalog-query.service';
import { CatalogStore } from '../data-access/catalog.store';

@Component({
  selector: 'app-catalog-active-filters',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (hasActiveFilters()) {
      <div class="active-filters" role="status" aria-label="Active filters">
        <span class="active-filters-label tech-font">Active filters:</span>
        @if (query()?.search) {
          <button class="filter-chip" (click)="removeFilter('search')" [attr.aria-label]="'Remove search filter: ' + query()?.search">
            Search: {{ query()?.search }}
            <span aria-hidden="true">&times;</span>
          </button>
        }
        @if (query()?.category) {
          <button class="filter-chip" (click)="removeFilter('category')" [attr.aria-label]="'Remove category filter: ' + query()?.category">
            {{ query()?.category }}
            <span aria-hidden="true">&times;</span>
          </button>
        }
        @if (query()?.brand) {
          <button class="filter-chip" (click)="removeFilter('brand')" [attr.aria-label]="'Remove brand filter: ' + query()?.brand">
            Brand: {{ query()?.brand }}
            <span aria-hidden="true">&times;</span>
          </button>
        }
        @if (query()?.minPrice !== undefined) {
          <button class="filter-chip" (click)="removeFilter('minPrice')" [attr.aria-label]="'Remove minimum price filter: ' + query()?.minPrice + ' EGP'">
            Min: {{ query()?.minPrice | number }} EGP
            <span aria-hidden="true">&times;</span>
          </button>
        }
        @if (query()?.maxPrice !== undefined) {
          <button class="filter-chip" (click)="removeFilter('maxPrice')" [attr.aria-label]="'Remove maximum price filter: ' + query()?.maxPrice + ' EGP'">
            Max: {{ query()?.maxPrice | number }} EGP
            <span aria-hidden="true">&times;</span>
          </button>
        }
        @if (query()?.sort) {
          <button class="filter-chip" (click)="removeFilter('sort')" [attr.aria-label]="'Remove sort filter: ' + sortLabel()">
            Sort: {{ sortLabel() }}
            <span aria-hidden="true">&times;</span>
          </button>
        }
        <button class="clear-all-btn tech-font" (click)="clearAll()" aria-label="Clear all filters">
          Clear all
        </button>
      </div>
    }
  `,
  styles: [`
    .active-filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 12px 0;
      border-top: 1px solid var(--color-outline-variant);
      margin-bottom: 8px;
    }
    .active-filters-label {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
    }
    .filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--color-surface-container-high);
      border: 1px solid var(--color-primary);
      color: var(--color-primary);
      font-family: var(--font-mono);
      font-size: 13px;
      cursor: pointer;
      transition:
        background-color 0.2s ease,
        color 0.2s ease;
    }
    .filter-chip:hover {
      background: var(--color-primary);
      color: var(--color-on-primary);
    }
    .clear-all-btn {
      background: transparent;
      border: none;
      color: var(--color-on-surface-variant);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      text-decoration: underline;
      padding: 4px 8px;
      transition: color 0.2s;
    }
    .clear-all-btn:hover { color: var(--color-on-surface); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogActiveFiltersComponent {
  private readonly queryService = inject(CatalogQueryService);
  private readonly catalogStore = inject(CatalogStore);

  readonly query = this.catalogStore.query;

  readonly hasActiveFilters = computed(() => {
    const q = this.query();
    return !!(q?.search || q?.category || q?.brand || q?.minPrice !== undefined || q?.maxPrice !== undefined || q?.sort);
  });

  readonly sortLabel = computed(() => {
    const sort = this.query()?.sort;
    if (sort === 'price_asc') return 'Price ↑';
    if (sort === 'price_desc') return 'Price ↓';
    if (sort === 'newest') return 'Newest';
    return '';
  });

  removeFilter(key: 'search' | 'category' | 'brand' | 'minPrice' | 'maxPrice' | 'sort'): void {
    // Use explicit key removal rather than merging empty object
    this.queryService.removeFilters([key]);
  }

  clearAll(): void {
    this.queryService.removeFilters(['search', 'category', 'brand', 'minPrice', 'maxPrice', 'sort']);
  }
}
