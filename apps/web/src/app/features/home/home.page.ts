/**
 * HomePage is the combined Home+Catalog screen at /.
 * It delegates entirely to the Catalog UI components.
 * This file is retained so the route table entry at path '' continues to work
 * without changing the route definition.
 */
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CatalogStore } from '../catalog/data-access/catalog.store';
import { CatalogSearchComponent } from '../catalog/ui/catalog-search.component';
import { CatalogFiltersComponent } from '../catalog/ui/catalog-filters.component';
import { CatalogActiveFiltersComponent } from '../catalog/ui/catalog-active-filters.component';
import { CatalogGridComponent } from '../catalog/ui/catalog-grid.component';
import { CatalogPaginationComponent } from '../catalog/ui/catalog-pagination.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CatalogSearchComponent,
    CatalogFiltersComponent,
    CatalogActiveFiltersComponent,
    CatalogGridComponent,
    CatalogPaginationComponent
  ],
  template: `
    <div class="catalog-page app-container">
      <!-- Hero: Search + Category Ribbon -->
      <app-catalog-search></app-catalog-search>

      <!-- Filters bar -->
      <div class="catalog-toolbar">
        <app-catalog-filters></app-catalog-filters>
      </div>

      <!-- Active Filters Summary -->
      <app-catalog-active-filters></app-catalog-active-filters>

      <!-- Results anchor for focus management after page change -->
      <div id="catalog-results-top" tabindex="-1" class="sr-only"></div>

      <!-- Product Grid -->
      <section id="catalog-results" role="region" aria-labelledby="catalog-results-heading">
        <h2 id="catalog-results-heading" class="sr-only">Product catalog results</h2>
        <app-catalog-grid></app-catalog-grid>
      </section>

      <!-- Pagination -->
      <app-catalog-pagination></app-catalog-pagination>
    </div>
  `,
  styles: [`
    .catalog-page {
      padding-bottom: 48px;
    }
    .catalog-toolbar {
      margin-top: 24px;
    }
    .sr-only {
      position: absolute;
      width: 1px; height: 1px; margin: -1px; padding: 0;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage {
  constructor() {
    inject(CatalogStore);
  }
}
