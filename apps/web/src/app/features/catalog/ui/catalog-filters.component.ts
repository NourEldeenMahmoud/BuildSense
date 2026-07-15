import { Component, ChangeDetectionStrategy, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogQueryService } from '../data-access/catalog-query.service';
import { CatalogStore } from '../data-access/catalog.store';
import { CategoryService } from '../data-access/category.service';
import { OverlayComponent } from '../../../shared/components/overlay.component';

@Component({
  selector: 'app-catalog-filters',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayComponent],
  template: `
    <!-- Desktop filter toggle -->
    <div class="filters-header">
      <button
        class="filters-toggle btn btn-secondary"
        type="button"
        data-testid="catalog-filters-toggle"
        [attr.aria-expanded]="isFiltersOpen() || isMobileDrawerOpen()"
        [attr.aria-controls]="isMobileDrawerOpen() ? 'overlay-dialog' : 'filter-panel'"
        (click)="toggleFilters()">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="6" x2="16" y2="6"></line>
          <line x1="8" y1="12" x2="20" y2="12"></line>
          <line x1="4" y1="18" x2="12" y2="18"></line>
        </svg>
        Filters
        @if (activeFilterCount() > 0) {
          <span class="filter-count" data-testid="active-filter-count" aria-label="{{ activeFilterCount() }} active filters">{{ activeFilterCount() }}</span>
        }
      </button>
    </div>

    <!-- Filter Panel (Desktop) -->
    <div
      id="filter-panel"
      class="filter-panel"
      data-testid="filter-panel"
      [class.open]="isFiltersOpen()"
      role="search"
      aria-label="Product filters">

      <div class="filter-group">
        <label for="filter-category" class="filter-label tech-font">Category</label>
        <select
          id="filter-category"
          class="filter-input input-field"
          data-testid="filter-category"
          [value]="pendingCategory()"
          (change)="onCategoryChange($event)"
          aria-label="Filter by category">
          <option value="">All Categories</option>
          @for (cat of categories(); track cat) {
            <option [value]="cat">{{ cat }}</option>
          }
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-brand" class="filter-label tech-font">Brand</label>
        <input
          id="filter-brand"
          class="filter-input input-field"
          type="text"
          data-testid="filter-brand"
          placeholder="e.g. ASUS, Corsair"
          [value]="pendingBrand()"
          (input)="pendingBrand.set(toInputValue($event))"
          aria-label="Filter by brand"
        />
      </div>

      <div class="filter-group">
        <label for="filter-min-price" class="filter-label tech-font">Min Price (EGP)</label>
        <input
          id="filter-min-price"
          class="filter-input input-field"
          type="number"
          data-testid="filter-min-price"
          min="0"
          placeholder="0"
          [value]="pendingMinPrice() ?? ''"
          (input)="pendingMinPrice.set(toNumberValue($event))"
          aria-label="Minimum price in EGP"
        />
      </div>

      <div class="filter-group">
        <label for="filter-max-price" class="filter-label tech-font">Max Price (EGP)</label>
        <input
          id="filter-max-price"
          class="filter-input input-field"
          type="number"
          data-testid="filter-max-price"
          min="0"
          placeholder="Any"
          [value]="pendingMaxPrice() ?? ''"
          (input)="pendingMaxPrice.set(toNumberValue($event))"
          aria-label="Maximum price in EGP"
        />
      </div>

      <div class="filter-group">
        <label for="filter-sort" class="filter-label tech-font">Sort By</label>
        <select
          id="filter-sort"
          class="filter-input input-field"
          data-testid="filter-sort"
          [value]="pendingSort()"
          (change)="pendingSort.set(toSortValue($event))"
          aria-label="Sort products by">
          <option value="">Relevance</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <div class="filter-actions">
        <button class="btn btn-primary" type="button" data-testid="apply-filters" (click)="applyFilters()">Apply</button>
        <button class="btn btn-secondary" type="button" data-testid="clear-filters" (click)="clearFilters()">Clear All</button>
      </div>
    </div>

    <!-- Mobile filter drawer via overlay -->
    <app-overlay
      [isOpen]="isMobileDrawerOpen()"
      (isOpenChange)="onMobileDrawerChange($event)"
      ariaLabel="Filter products"
      title="Filters">
      
      <div class="mobile-filter-content">
        <div class="filter-group">
          <label for="mobile-filter-category" class="filter-label tech-font">Category</label>
          <select
            id="mobile-filter-category"
            class="filter-input input-field"
            data-testid="mobile-filter-category"
            [value]="pendingCategory()"
            (change)="onCategoryChange($event)">
            <option value="">All Categories</option>
            @for (cat of categories(); track cat) {
              <option [value]="cat">{{ cat }}</option>
            }
          </select>
        </div>
        <div class="filter-group">
          <label for="mobile-filter-brand" class="filter-label tech-font">Brand</label>
          <input
            id="mobile-filter-brand"
            class="filter-input input-field"
            type="text"
            data-testid="mobile-filter-brand"
            placeholder="e.g. ASUS, Corsair"
            [value]="pendingBrand()"
            (input)="pendingBrand.set(toInputValue($event))"
            aria-label="Filter by brand"
          />
        </div>
        <div class="filter-group">
          <label for="mobile-filter-min" class="filter-label tech-font">Min Price (EGP)</label>
          <input
            id="mobile-filter-min"
            class="filter-input input-field"
            type="number"
            data-testid="mobile-filter-min"
            min="0"
            placeholder="0"
            [value]="pendingMinPrice() ?? ''"
            (input)="pendingMinPrice.set(toNumberValue($event))"
          />
        </div>
        <div class="filter-group">
          <label for="mobile-filter-max" class="filter-label tech-font">Max Price (EGP)</label>
          <input
            id="mobile-filter-max"
            class="filter-input input-field"
            type="number"
            data-testid="mobile-filter-max"
            min="0"
            placeholder="Any"
            [value]="pendingMaxPrice() ?? ''"
            (input)="pendingMaxPrice.set(toNumberValue($event))"
          />
        </div>
        <div class="filter-group">
          <label for="mobile-filter-sort" class="filter-label tech-font">Sort By</label>
          <select
            id="mobile-filter-sort"
            class="filter-input input-field"
            data-testid="mobile-filter-sort"
            [value]="pendingSort()"
            (change)="pendingSort.set(toSortValue($event))">
            <option value="">Relevance</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>
      
      <div footer>
        <button class="btn btn-secondary" type="button" data-testid="mobile-clear-filters" (click)="clearFilters()">Clear All</button>
        <button class="btn btn-primary" type="button" data-testid="mobile-apply-filters" (click)="applyFiltersAndClose()">Apply Filters</button>
      </div>
    </app-overlay>
  `,
  styles: [`
    .filters-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .filters-toggle {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      padding: 8px 16px;
    }
    .filter-count {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-radius: 50%;
      width: 20px;
      height: 20px;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono);
    }
    .filter-panel {
      display: none;
      background: var(--color-surface-container);
      border: 1px solid var(--color-outline-variant);
      padding: 24px;
      gap: 20px;
      flex-direction: column;
      margin-bottom: 24px;
    }
    .filter-panel.open {
      display: flex;
    }
    @media (min-width: 768px) {
      .filter-panel {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: flex-end;
      }
      .filter-group {
        flex: 1;
        min-width: 160px;
      }
    }
    .filter-label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
      margin-bottom: 6px;
    }
    .filter-input {
      width: 100%;
      font-family: var(--font-primary);
    }
    .filter-actions {
      display: flex;
      gap: 12px;
      align-items: flex-end;
    }
    .mobile-filter-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogFiltersComponent {
  private readonly queryService = inject(CatalogQueryService);
  private readonly catalogStore = inject(CatalogStore);
  private readonly categoryService = inject(CategoryService);

  readonly categories = this.categoryService.categories;

  readonly isFiltersOpen = signal(false);
  readonly isMobileDrawerOpen = signal(false);

  // Pending (not yet applied) filter values
  readonly pendingCategory = signal<string>('');
  readonly pendingBrand = signal<string>('');
  readonly pendingMinPrice = signal<number | undefined>(undefined);
  readonly pendingMaxPrice = signal<number | undefined>(undefined);
  readonly pendingSort = signal<string>('');

  readonly activeFilterCount = computed(() => {
    const q = this.catalogStore.query();
    let count = 0;
    if (q?.category) count++;
    if (q?.brand) count++;
    if (q?.minPrice !== undefined) count++;
    if (q?.maxPrice !== undefined) count++;
    if (q?.sort) count++;
    return count;
  });

  constructor() {
    this.categoryService.load();
    // Initialize pending values from current query
    const q = this.catalogStore.query();
    if (q) {
      this.pendingCategory.set(q.category ?? '');
      this.pendingBrand.set(q.brand ?? '');
      this.pendingMinPrice.set(q.minPrice);
      this.pendingMaxPrice.set(q.maxPrice);
      this.pendingSort.set(q.sort ?? '');
    }
    // Keep pending values in sync with query changes
    effect(() => {
      const q = this.catalogStore.query();
      if (q) {
        this.pendingCategory.set(q.category ?? '');
        this.pendingBrand.set(q.brand ?? '');
        this.pendingMinPrice.set(q.minPrice);
        this.pendingMaxPrice.set(q.maxPrice);
        this.pendingSort.set(q.sort ?? '');
      }
    });
  }

  onCategoryChange(event: Event): void {
    this.pendingCategory.set((event.target as HTMLSelectElement).value);
  }

  toggleFilters(): void {
    if (this.isMobileViewport()) {
      this.isMobileDrawerOpen.update(v => !v);
    } else {
      this.isFiltersOpen.update(v => !v);
    }
  }

  /** Check if the viewport is below the tablet breakpoint (768px). */
  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  }

  applyFilters(): void {
    const params: Record<string, unknown> = {};
    if (this.pendingCategory()) params['category'] = this.pendingCategory();
    if (this.pendingBrand()) params['brand'] = this.pendingBrand();
    if (this.pendingMinPrice() !== undefined) params['minPrice'] = this.pendingMinPrice();
    if (this.pendingMaxPrice() !== undefined) params['maxPrice'] = this.pendingMaxPrice();
    if (this.pendingSort()) params['sort'] = this.pendingSort();
    this.queryService.updateFilters(params as Parameters<typeof this.queryService.updateFilters>[0]);
  }

  applyFiltersAndClose(): void {
    this.applyFilters();
    this.isMobileDrawerOpen.set(false);
  }

  onMobileDrawerChange(open: boolean): void {
    this.isMobileDrawerOpen.set(open);
  }

  clearFilters(): void {
    this.pendingCategory.set('');
    this.pendingBrand.set('');
    this.pendingMinPrice.set(undefined);
    this.pendingMaxPrice.set(undefined);
    this.pendingSort.set('');
    this.queryService.removeFilters(['category', 'brand', 'minPrice', 'maxPrice', 'sort']);
    this.isMobileDrawerOpen.set(false);
    this.isFiltersOpen.set(false);
  }

  toInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  toNumberValue(event: Event): number | undefined {
    const v = parseFloat((event.target as HTMLInputElement).value);
    return isNaN(v) ? undefined : v;
  }

  toSortValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }
}
