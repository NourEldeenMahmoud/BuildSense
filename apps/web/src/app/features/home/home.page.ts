/**
 * HomePage is the combined Home+Catalog screen at /.
 * It delegates entirely to the Catalog UI components.
 * This file is retained so the route table entry at path '' continues to work
 * without changing the route definition.
 */
import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CatalogStore } from '../catalog/data-access/catalog.store';
import { CatalogSearchComponent } from '../catalog/ui/catalog-search.component';
import { CatalogFiltersComponent } from '../catalog/ui/catalog-filters.component';
import { CatalogActiveFiltersComponent } from '../catalog/ui/catalog-active-filters.component';
import { CatalogGridComponent } from '../catalog/ui/catalog-grid.component';
import { CatalogPaginationComponent } from '../catalog/ui/catalog-pagination.component';
import { CatalogQueryService } from '../catalog/data-access/catalog-query.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CatalogSearchComponent,
    CatalogFiltersComponent,
    CatalogActiveFiltersComponent,
    CatalogGridComponent,
    CatalogPaginationComponent,
  ],
  template: `
    <div class="catalog-page">
      <app-catalog-search></app-catalog-search>

      <div class="catalog-toolbar">
        <app-catalog-filters></app-catalog-filters>
      </div>

      <app-catalog-active-filters></app-catalog-active-filters>

      <div id="catalog-results-top" tabindex="-1" class="sr-only"></div>

      <section id="catalog-results" role="region" aria-labelledby="catalog-results-heading">
        <div class="inventory-header">
          <div>
            <h2 id="catalog-results-heading">Active Inventory</h2>
            <p class="inventory-context tech-font">
              Showing {{ activeContext() }}
            </p>
          </div>
          <label class="sort-control tech-font">
            <span>Sort by:</span>
            <select
              [value]="currentSort()"
              (change)="changeSort($event)"
              data-testid="inventory-sort"
              aria-label="Sort inventory"
            >
              <option value="">Relevance</option>
              <option value="price_asc">Price: Low–High</option>
              <option value="price_desc">Price: High–Low</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
        <app-catalog-grid></app-catalog-grid>
      </section>

      <app-catalog-pagination></app-catalog-pagination>
    </div>
  `,
  styles: [
    `
      .catalog-page {
        margin-top: calc(-1 * var(--space-margin-desktop));
        padding-bottom: 48px;
        background-image:
          linear-gradient(rgba(111, 125, 82, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(111, 125, 82, 0.035) 1px, transparent 1px);
        background-size: 32px 32px;
      }
      .catalog-toolbar {
        margin-bottom: 48px;
      }
      .inventory-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        margin: 0 0 32px;
      }
      .inventory-header h2 {
        margin: 0;
        font-size: 32px;
        font-weight: 600;
        line-height: 40px;
        letter-spacing: 0;
        text-transform: uppercase;
      }
      .inventory-context {
        margin-top: 5px;
        color: #848b77;
        font-size: 13px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .sort-control {
        display: flex;
        align-items: center;
        gap: 9px;
        color: #848b77;
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .sort-control select {
        height: 40px;
        min-width: 190px;
        padding: 0 30px 0 10px;
        border: 1px solid var(--color-outline-variant);
        border-radius: 0;
        outline: 0;
        background: var(--color-surface-container-high);
        color: var(--color-on-surface);
        font: 12px var(--font-mono);
        text-transform: uppercase;
      }
      .sort-control select:focus {
        border-color: var(--color-primary);
      }
      @media (max-width: 768px) {
        .catalog-page {
          margin-top: calc(-1 * var(--space-margin-mobile));
        }
        .inventory-header {
          align-items: stretch;
          flex-direction: column;
        }
        .sort-control {
          justify-content: space-between;
        }
        .sort-control select {
          min-width: 0;
          flex: 1;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  readonly catalogStore = inject(CatalogStore);
  private readonly queryService = inject(CatalogQueryService);

  readonly currentSort = computed(() => this.catalogStore.query()?.sort ?? '');
  readonly activeContext = computed(() => {
    const query = this.catalogStore.query();
    if (query?.category && query.search) {
      return `${query.category} parameters matching “${query.search}”`;
    }
    if (query?.category) return `${query.category} parameters`;
    if (query?.search) return `components matching “${query.search}”`;
    return 'all components';
  });

  changeSort(event: Event): void {
    const sort = (event.target as HTMLSelectElement).value;
    if (sort) {
      this.queryService.updateFilters({ sort: sort as 'price_asc' | 'price_desc' | 'newest' });
    } else {
      this.queryService.removeFilters(['sort']);
    }
  }
}
