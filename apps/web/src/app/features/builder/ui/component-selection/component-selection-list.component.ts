import { Component, EventEmitter } from '@angular/core';
import type {
  ComponentSelectionViewModel,
} from './component-selection-view.models';
import type { CandidateAvailabilityFilter } from '@buildsense/contracts';

/**
 * Presentational component-selection drawer/list shell.
 *
 * Input-driven: receives an immutable ComponentSelectionViewModel.
 * Emits 'selectCandidate' with the candidate product ID when a row is clicked.
 * Emits 'close' when the close button is clicked.
 * Emits 'searchChange' when the search input value changes.
 * Emits 'filterChange' when a filter chip is selected.
 * Emits 'loadMore' when the load more button is clicked.
 * Loading state shows a spinner instead of the list.
 * Error state shows the error message with a retry note.
 */
@Component({
  selector: 'app-component-selection-list',
  standalone: true,
  inputs: [
    'selection',
    'loading',
    'loadingMore',
    'errorMessage',
    'appendError',
    'currentSearch',
    'currentAvailability',
  ],
  outputs: ['selectCandidate', 'close', 'searchChange', 'filterChange', 'loadMore'],
  template: `
    <section class="selection-drawer" role="dialog" [attr.aria-label]="selection.slotDisplayName + ' selection'">
      <header class="drawer-header">
        <h2 class="drawer-title">Select {{ selection.slotDisplayName }}</h2>
        <div class="drawer-header-actions">
          <span class="drawer-count tech-font">{{ selection.totalItems }} options</span>
          <button
            class="drawer-close-btn"
            type="button"
            aria-label="Close selection"
            (click)="close.emit()">
            ✕
          </button>
        </div>
      </header>

      <div class="drawer-search" role="search">
        <label class="search-label" for="selection-search">Search components</label>
        <input
          id="selection-search"
          class="search-input input-field"
          type="search"
          placeholder="Search by name, brand, or model..."
          [value]="currentSearch"
          (input)="onSearchInput($event)"
          aria-describedby="selection-search-desc" />
        <span id="selection-search-desc" class="sr-only">Type to search within {{ selection.slotDisplayName }} candidates</span>
      </div>

      <div class="drawer-filters" role="group" aria-label="Availability filter">
        <button
          type="button"
          class="filter-chip"
          [class.active]="currentAvailability === 'ALL'"
          [attr.aria-pressed]="currentAvailability === 'ALL'"
          (click)="onFilterClick('ALL')">
          All
        </button>
        <button
          type="button"
          class="filter-chip"
          [class.active]="currentAvailability === 'IN_STOCK'"
          [attr.aria-pressed]="currentAvailability === 'IN_STOCK'"
          (click)="onFilterClick('IN_STOCK')">
          In Stock
        </button>
        <button
          type="button"
          class="filter-chip"
          [class.active]="currentAvailability === 'OUT_OF_STOCK'"
          [attr.aria-pressed]="currentAvailability === 'OUT_OF_STOCK'"
          (click)="onFilterClick('OUT_OF_STOCK')">
          Out of Stock
        </button>
      </div>

      @if (loading) {
        <div class="drawer-loading" role="status" aria-label="Loading candidates">
          <div class="loading-spinner" aria-hidden="true"></div>
          <span class="loading-text tech-font">Loading candidates…</span>
        </div>
      } @else if (errorMessage) {
        <div class="drawer-error" role="alert">
          <span class="error-text">{{ errorMessage }}</span>
          <span class="error-hint">Please try again later.</span>
        </div>
      } @else if (selection.groups.length > 0) {
        @if (appendError) {
          <div class="drawer-append-error" role="status">
            <span class="error-text">{{ appendError }}</span>
          </div>
        }
        <ul class="product-list" role="listbox" [attr.aria-label]="selection.slotDisplayName + ' candidates'">
          @for (group of selection.groups; track group.status) {
            @if (group.status !== 'UNKNOWN') {
              <li class="group-header" role="presentation">
                <span
                  class="status-badge"
                  [attr.data-status]="group.status"
                  [attr.aria-label]="group.statusLabel">
                  {{ group.statusLabel }}
                </span>
                @if (group.topReasons.length > 0) {
                  <span class="group-reasons" role="note">
                    {{ group.topReasons[0] }}
                  </span>
                }
              </li>
            }
            @for (candidate of group.candidates; track candidate.id) {
              <li
                class="product-row"
                role="option"
                [attr.aria-selected]="false">
                <button
                  class="product-select-btn"
                  type="button"
                  [attr.aria-label]="'Select ' + candidate.name"
                  (click)="selectCandidate.emit(candidate.id)">
                  <div class="product-info">
                    <span class="product-name">{{ candidate.name }}</span>
                    <span class="product-brand-model">{{ candidate.brand }} {{ candidate.model }}</span>
                  </div>
                  <div class="product-meta">
                    <a
                      class="product-price tech-font"
                      [href]="candidate.sourceUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      (click)="$event.stopPropagation()">
                      {{ candidate.priceLabel }}
                    </a>
                    <span class="product-store">{{ candidate.storeLabel }}</span>
                    <span
                      class="product-availability"
                      [attr.data-availability]="candidate.availabilityLabel">
                      {{ candidate.availabilityLabel }}
                    </span>
                    @if (candidate.offers.length > 1) {
                      <details class="product-offers">
                        <summary class="offers-summary tech-font">
                          {{ candidate.offers.length }} offers
                        </summary>
                        <ul class="offers-list" role="list">
                          @for (offer of candidate.offers; track offer.sourceUrl) {
                            <li class="offer-item">
                              <span class="offer-store">{{ offer.storeLabel }}</span>
                              <a
                                class="offer-price tech-font"
                                [href]="offer.sourceUrl"
                                target="_blank"
                                rel="noopener noreferrer"
                                (click)="$event.stopPropagation()">
                                {{ offer.priceLabel }}
                              </a>
                              <span
                                class="offer-availability"
                                [attr.data-availability]="offer.availabilityLabel">
                                {{ offer.availabilityLabel }}
                              </span>
                            </li>
                          }
                        </ul>
                      </details>
                    }
                  </div>
                </button>
              </li>
            }
          }
        </ul>

        @if (selection.hasNextPage) {
          <div class="drawer-load-more">
            <button
              type="button"
              class="load-more-btn"
              [disabled]="loadingMore"
              (click)="loadMore.emit()">
              @if (loadingMore) {
                <span class="loading-spinner-small" aria-hidden="true"></span>
                Loading…
              } @else {
                Load more
              }
            </button>
          </div>
        }
      } @else {
        <div class="drawer-empty" role="status">
          <span class="material-symbols-outlined" aria-hidden="true">inventory_2</span>
          <strong>No candidates available</strong>
          <span>No catalog products are currently available for this slot.</span>
        </div>
      }
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
    :host-context(.selection-drawer-wrapper) .selection-drawer {
      min-height: 100%;
      max-height: none;
      border: 0;
    }
    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .drawer-header-actions {
      display: flex;
      align-items: center;
      gap: var(--space-base);
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
    .drawer-close-btn {
      background: transparent;
      border: none;
      color: var(--color-on-surface-variant);
      font-size: 16px;
      cursor: pointer;
      padding: 2px 6px;
      line-height: 1;
    }
    .drawer-close-btn:hover {
      color: var(--color-on-surface);
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
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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
      cursor: pointer;
      background: transparent;
    }
    .filter-chip:hover {
      background-color: var(--color-surface-container-low);
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
    .group-header {
      display: flex;
      align-items: center;
      gap: var(--space-base);
      padding: 8px var(--space-gutter);
      background-color: var(--color-surface-container-low);
      border-bottom: var(--border-width) solid var(--color-border);
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: var(--radius-none);
    }
    .status-badge[data-status="COMPATIBLE"] {
      background-color: var(--color-success-container, #d4edda);
      color: var(--color-on-success-container, #155724);
    }
    .status-badge[data-status="COMPATIBLE_WITH_WARNINGS"] {
      background-color: var(--color-warning-container, #fff3cd);
      color: var(--color-on-warning-container, #856404);
    }
    .status-badge[data-status="INCOMPATIBLE"] {
      background-color: var(--color-error-container, #f8d7da);
      color: var(--color-on-error-container, #721c24);
    }
    .group-reasons {
      font-size: 12px;
      color: var(--color-on-surface-variant);
      font-style: italic;
    }
    .product-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: var(--border-width) solid var(--color-border);
    }
    .product-row:last-child {
      border-bottom: none;
    }
    .product-select-btn {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      width: 100%;
      padding: var(--space-base) var(--space-gutter);
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
    }
    .product-select-btn:hover {
      background-color: var(--color-surface-container-low);
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
    .product-brand-model {
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
      text-decoration: none;
    }
    .product-price:hover {
      text-decoration: underline;
    }
    .product-store {
      font-size: 11px;
      color: var(--color-on-surface-variant);
    }
    .product-availability {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
    }
    .product-availability[data-availability="In Stock"] {
      color: var(--color-success, #155724);
    }
    .product-availability[data-availability="Out of Stock"] {
      color: var(--color-error, #721c24);
    }
    .product-offers {
      margin-top: 4px;
    }
    .offers-summary {
      font-size: 11px;
      color: var(--color-primary);
      cursor: pointer;
    }
    .offers-list {
      list-style: none;
      padding: 4px 0 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .offer-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }
    .offer-store {
      color: var(--color-on-surface-variant);
      flex-shrink: 0;
    }
    .offer-price {
      font-weight: 600;
      color: var(--color-primary);
      text-decoration: none;
      flex-shrink: 0;
    }
    .offer-price:hover {
      text-decoration: underline;
    }
    .offer-availability {
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
    }
    .drawer-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 120px;
    }
    .loading-spinner {
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
    .loading-text {
      font-size: 12px;
      color: var(--color-on-surface-variant);
    }
    .drawer-load-more {
      display: flex;
      justify-content: center;
      padding: var(--space-base) 0;
    }
    .load-more-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      border: var(--border-width) solid var(--color-outline-variant);
      border-radius: var(--radius-none);
      background: transparent;
      color: var(--color-primary);
      cursor: pointer;
    }
    .load-more-btn:hover:not(:disabled) {
      background-color: var(--color-surface-container-low);
    }
    .load-more-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .loading-spinner-small {
      width: 14px;
      height: 14px;
      border: 2px solid var(--color-surface-container-high);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    .drawer-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: var(--space-gutter);
      text-align: center;
    }
    .drawer-append-error {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px var(--space-gutter);
      background-color: var(--color-error-container, #f8d7da);
      color: var(--color-on-error-container, #721c24);
      font-size: 12px;
    }
    .drawer-empty {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 240px;
      border: var(--border-width) solid var(--color-outline-variant);
      color: var(--color-on-surface-variant);
      text-align: center;
    }
    .drawer-empty .material-symbols-outlined {
      color: var(--color-outline);
      font-size: 32px;
    }
    .drawer-empty strong {
      color: var(--color-on-surface);
      font-size: 16px;
      text-transform: uppercase;
    }
    .drawer-empty span:last-child {
      font-size: 13px;
    }
    .error-text {
      font-size: 14px;
      color: var(--color-error);
    }
    .error-hint {
      font-size: 12px;
      color: var(--color-on-surface-variant);
    }
  `,
})
export class ComponentSelectionListComponent {
  selection!: ComponentSelectionViewModel;
  loading = false;
  loadingMore = false;
  errorMessage: string | null = null;
  appendError: string | null = null;
  currentSearch = '';
  currentAvailability: CandidateAvailabilityFilter = 'ALL';
  selectCandidate = new EventEmitter<string>();
  close = new EventEmitter<void>();
  searchChange = new EventEmitter<string>();
  filterChange = new EventEmitter<CandidateAvailabilityFilter>();
  loadMore = new EventEmitter<void>();

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchChange.emit(value);
  }

  onFilterClick(filter: CandidateAvailabilityFilter): void {
    this.filterChange.emit(filter);
  }
}
