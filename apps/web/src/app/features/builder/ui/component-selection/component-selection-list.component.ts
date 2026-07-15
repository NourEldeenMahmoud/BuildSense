import { Component } from '@angular/core';
import type { ComponentSelectionViewModel } from './component-selection-view.models';

/**
 * Presentational component-selection drawer/list shell.
 *
 * Input-driven: receives an immutable ComponentSelectionViewModel.
 * Provides the Stitch selection composition: heading, search/filter UI shell,
 * product rows with name/price/availability, and active-slot styling.
 * No active search, no filtering logic, no persistence, no API calls,
 * no selection behavior — purely visual shell for fixture validation.
 */
@Component({
  selector: 'app-component-selection-list',
  standalone: true,
  inputs: ['selection'],
  template: `
    <section class="selection-drawer" role="dialog" [attr.aria-label]="selection.slotDisplayName + ' selection'">
      <header class="drawer-header">
        <h2 class="drawer-title">Select {{ selection.slotDisplayName }}</h2>
        <span class="drawer-count tech-font">{{ selection.candidates.length }} options</span>
      </header>

      <div class="drawer-search" role="search">
        <label class="search-label" for="selection-search">Search components</label>
        <input
          id="selection-search"
          class="search-input input-field"
          type="search"
          placeholder="Search by name or brand..."
          disabled
          aria-disabled="true" />
        <span class="search-hint" role="note">Search is not yet active</span>
      </div>

      <div class="drawer-filters" role="group" aria-label="Filter controls">
        <span class="filter-chip active" role="tab" aria-selected="true">All</span>
        <span class="filter-chip" role="tab" aria-selected="false">In Stock</span>
        <span class="filter-chip" role="tab" aria-selected="false">Out of Stock</span>
      </div>

      <ul class="product-list" role="listbox" [attr.aria-label]="selection.slotDisplayName + ' candidates'">
        @for (candidate of selection.candidates; track candidate.id) {
          <li
            class="product-row"
            role="option"
            [attr.aria-selected]="false">
            <div class="product-info">
              <span class="product-name">{{ candidate.name }}</span>
              <span class="product-brand">{{ candidate.brand }}</span>
            </div>
            <div class="product-meta">
              <span class="product-price tech-font">{{ candidate.priceLabel }}</span>
              <span class="product-availability">{{ candidate.availabilityLabel }}</span>
            </div>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .selection-drawer {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
      background-color: var(--color-surface-container);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-none);
      padding: var(--space-gutter);
      max-height: 600px;
      overflow-y: auto;
    }
    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .drawer-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--color-on-surface);
    }
    .drawer-count {
      font-size: 12px;
      color: var(--color-on-surface-variant);
    }
    .drawer-search {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .search-label {
      font-size: 12px;
      color: var(--color-on-surface-variant);
      font-weight: 600;
    }
    .search-input {
      width: 100%;
    }
    .search-hint {
      font-size: 11px;
      color: var(--color-on-surface-variant);
      font-style: italic;
    }
    .drawer-filters {
      display: flex;
      gap: var(--space-base);
    }
    .filter-chip {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: var(--border-width) solid var(--color-outline-variant);
      border-radius: var(--radius-none);
      color: var(--color-on-surface-variant);
      cursor: default;
    }
    .filter-chip.active {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
    .product-list {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .product-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-base) var(--space-gutter);
      border-bottom: var(--border-width) solid var(--color-border);
      min-height: 56px;
    }
    .product-row:last-child {
      border-bottom: none;
    }
    .product-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .product-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .product-brand {
      font-size: 12px;
      color: var(--color-on-surface-variant);
    }
    .product-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      flex-shrink: 0;
      margin-left: var(--space-base);
    }
    .product-price {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-primary);
    }
    .product-availability {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
    }
  `,
})
export class ComponentSelectionListComponent {
  selection!: ComponentSelectionViewModel;
}
