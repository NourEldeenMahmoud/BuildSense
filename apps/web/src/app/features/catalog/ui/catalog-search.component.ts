import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogQueryService } from '../data-access/catalog-query.service';
import { CategoryService } from '../data-access/category.service';

@Component({
  selector: 'app-catalog-search',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="catalog-hero" aria-label="Catalog search and categories">
      <!-- Hero heading -->
      <div class="hero-heading">
        <h1 class="hero-title">BuildSense Catalog</h1>
        <p class="hero-subtitle tech-font">Browse real PC hardware from Sigma</p>
      </div>

      <!-- Hero Search -->
      <div class="hero-search">
        <label for="catalog-search-input" class="sr-only">Search products</label>
        <div class="search-wrapper">
          <svg class="search-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            id="catalog-search-input"
            class="search-input"
            type="search"
            data-testid="catalog-search-input"
            placeholder="Search PC components..."
            [value]="currentSearch()"
            (input)="onSearchInput($event)"
            aria-label="Search products"
            autocomplete="off"
          />
          @if (currentSearch()) {
            <button
              class="search-clear"
              type="button"
              data-testid="search-clear"
              aria-label="Clear search"
              (click)="clearSearch()">
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          }
        </div>
      </div>

      <!-- Category Ribbon -->
      <nav class="category-ribbon" aria-label="Product categories" data-testid="category-ribbon">
        <button
          class="category-chip"
          data-testid="category-chip-all"
          [class.active]="!currentCategory()"
          [attr.aria-pressed]="!currentCategory()"
          (click)="selectCategory(null)">
          All
        </button>
        @for (cat of categories(); track cat) {
          <button
            class="category-chip"
            [attr.data-testid]="'category-chip-' + cat"
            [class.active]="currentCategory() === cat"
            [attr.aria-pressed]="currentCategory() === cat"
            [attr.aria-current]="currentCategory() === cat ? 'true' : null"
            (click)="selectCategory(cat)">
            {{ cat }}
          </button>
        }
        @if (categoryError()) {
          <span class="category-error tech-font" role="alert" data-testid="category-error">Failed to load categories</span>
        }
      </nav>

      <!-- Truthful CTA: scrolls to the results region within this page -->
      <div class="hero-cta">
        <a class="btn btn-primary hero-cta-link" href="#catalog-results"
           (click)="$event.preventDefault(); scrollToResults()">
          Browse components
        </a>
      </div>
    </section>
  `,
  styles: [`
    .catalog-hero {
      padding: 32px 0 0;
    }
    .hero-heading {
      margin-bottom: 24px;
    }
    .hero-title {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
      margin: 0 0 8px;
      color: var(--color-on-surface);
    }
    .hero-subtitle {
      margin: 0;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
    }
    .hero-cta {
      margin-top: 16px;
    }
    .hero-cta-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-decoration: none;
      color: var(--color-on-primary);
      background: var(--color-primary);
      border: 1px solid var(--color-primary);
      cursor: pointer;
      transition: background 0.2s;
    }
    .hero-cta-link:hover {
      background: var(--color-surface-container-high);
      color: var(--color-on-surface);
    }
    .hero-search {
      margin-bottom: 24px;
    }
    .search-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-icon {
      position: absolute;
      left: 16px;
      width: 18px;
      height: 18px;
      color: var(--color-on-surface-variant);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      background-color: var(--color-surface-container);
      border: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface);
      padding: 14px 44px;
      font-family: var(--font-primary);
      font-size: 16px;
      transition: border-color 0.2s, background-color 0.2s;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--color-primary);
      background-color: var(--color-surface-container-high);
    }
    .search-input::placeholder {
      color: var(--color-on-surface-variant);
    }
    .search-clear {
      position: absolute;
      right: 12px;
      background: transparent;
      border: none;
      color: var(--color-on-surface-variant);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      transition: color 0.2s;
    }
    .search-clear:hover { color: var(--color-on-surface); }
    .search-clear svg { width: 16px; height: 16px; }
    
    .category-ribbon {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
    }
    .category-ribbon::-webkit-scrollbar { display: none; }
    
    .category-chip {
      flex-shrink: 0;
      padding: 6px 16px;
      background: transparent;
      border: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface-variant);
      font-family: var(--font-mono);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .category-chip:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
    .category-chip.active,
    .category-chip[aria-pressed="true"] {
      background-color: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--color-on-primary);
    }
    .category-error {
      color: var(--color-error);
      font-size: 12px;
      align-self: center;
    }
    .sr-only {
      position: absolute;
      width: 1px; height: 1px; margin: -1px; padding: 0;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogSearchComponent {
  private readonly queryService = inject(CatalogQueryService);
  private readonly categoryService = inject(CategoryService);

  readonly categories = this.categoryService.categories;
  readonly categoryError = this.categoryService.error;
  
  // Track current search and category from the live query params stream
  private readonly queryParams = toSignal(this.queryService.queryParams$);
  
  readonly currentSearch = computed(() => this.queryParams()?.search ?? '');
  readonly currentCategory = computed(() => this.queryParams()?.category);

  constructor() {
    this.categoryService.load();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.queryService.debounceUpdateFilters({ search: value });
    } else {
      // Remove search from URL explicitly instead of merging empty object
      this.queryService.removeFilters(['search']);
    }
  }

  clearSearch(): void {
    this.queryService.removeFilters(['search']);
  }

  selectCategory(cat: string | null): void {
    if (cat) {
      this.queryService.updateFilters({ category: cat });
    } else {
      this.queryService.removeFilters(['category']);
    }
  }

  scrollToResults(): void {
    const el = document.getElementById('catalog-results');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.focus();
    }
  }
}
