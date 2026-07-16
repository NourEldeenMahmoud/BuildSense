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
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CatalogSearchComponent,
    CatalogFiltersComponent,
    CatalogActiveFiltersComponent,
    CatalogGridComponent,
    CatalogPaginationComponent,
    DecimalPipe,
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
            <span class="section-kicker tech-font">Component database // Live records</span>
            <h2 id="catalog-results-heading">Active Inventory</h2>
            <p class="inventory-context tech-font">
              @if (totalItems() !== null) {
                {{ totalItems() | number }} products
              } @else {
                Awaiting inventory count
              }
              @if (activeContext()) {
                <span aria-hidden="true"> / </span>{{ activeContext() }}
              }
            </p>
          </div>
          <label class="sort-control tech-font">
            <span>Sort by</span>
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
        padding-top: 18px;
      }
      .inventory-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        margin: 28px 0 18px;
        padding-top: 24px;
        border-top: 1px solid var(--color-border);
      }
      .section-kicker {
        display: block;
        margin-bottom: 7px;
        color: var(--color-primary);
        font-size: 8px;
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }
      .inventory-header h2 {
        margin: 0;
        font-size: clamp(24px, 3vw, 34px);
        font-weight: 750;
        letter-spacing: -0.03em;
        text-transform: uppercase;
      }
      .inventory-context {
        margin-top: 5px;
        color: #848b77;
        font-size: 9px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .sort-control {
        display: flex;
        align-items: center;
        gap: 9px;
        color: #848b77;
        font-size: 8px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .sort-control select {
        height: 36px;
        min-width: 190px;
        padding: 0 30px 0 10px;
        border: 1px solid var(--color-outline-variant);
        border-radius: 0;
        outline: 0;
        background: var(--color-surface-container-high);
        color: var(--color-on-surface);
        font: 9px var(--font-mono);
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
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  readonly catalogStore = inject(CatalogStore);
  private readonly queryService = inject(CatalogQueryService);

  readonly totalItems = computed(() => this.catalogStore.result()?.pagination.totalItems ?? null);
  readonly currentSort = computed(() => this.catalogStore.query()?.sort ?? '');
  readonly activeContext = computed(() => {
    const query = this.catalogStore.query();
    if (query?.category && query.search) return `${query.category} matching “${query.search}”`;
    if (query?.category) return query.category;
    if (query?.search) return `Results matching “${query.search}”`;
    return 'All components';
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
