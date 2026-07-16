import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogQueryService } from '../data-access/catalog-query.service';
import { CategoryService } from '../data-access/category.service';
import { CatalogStore } from '../data-access/catalog.store';

@Component({
  selector: 'app-catalog-search',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="catalog-hero" aria-label="Catalog search and categories">
      <div class="hero-content">
        <div
          class="system-badge tech-font"
          [class.system-error]="catalogStore.error()"
          role="status"
        >
          @if (catalogStore.error()) {
            Catalog connection unavailable
          } @else if (catalogStore.initialLoading()) {
            Synchronizing inventory
          } @else {
            System ready // Sigma catalog online
          }
        </div>

        <h1 class="hero-title">Build smarter.<br /><span>Know what fits.</span></h1>
        <p class="hero-subtitle">
          Search real hardware inventory, inspect source-backed product data, and assemble your next
          PC with compatibility guidance.
        </p>

        <div class="hero-search">
          <label for="hero-component-search" class="sr-only">Search specific components</label>
          <div class="search-wrapper">
            <svg
              class="search-icon"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="7"></circle>
              <path d="m20 20-4-4"></path>
            </svg>
            <input
              id="hero-component-search"
              class="search-input"
              type="search"
              placeholder="Search specific components (e.g. RTX 4070)..."
              [value]="currentSearch()"
              (input)="onSearchInput($event)"
              aria-label="Search specific components"
              autocomplete="off"
            />
            @if (currentSearch()) {
              <button
                class="search-clear"
                type="button"
                aria-label="Clear hero search"
                (click)="clearSearch()"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="m6 6 12 12M18 6 6 18"></path>
                </svg>
              </button>
            }
          </div>
        </div>

        <div class="hero-actions">
          <a class="btn btn-primary hero-primary" routerLink="/builder"
            >Initialize build <span aria-hidden="true">→</span></a
          >
          <a
            class="btn btn-secondary hero-secondary"
            href="#catalog-results"
            (click)="$event.preventDefault(); scrollToResults()"
            >Explore database</a
          >
        </div>
      </div>
    </section>

    <nav
      class="category-ribbon"
      aria-label="Quick product categories"
      data-testid="category-ribbon"
    >
      <span class="category-label tech-font">Quick access</span>
      <button
        class="category-chip"
        data-testid="category-chip-all"
        [class.active]="!currentCategory()"
        [attr.aria-pressed]="!currentCategory()"
        (click)="selectCategory(null)"
      >
        All
      </button>
      @for (cat of quickCategories(); track cat.label) {
        <button
          class="category-chip"
          [attr.data-testid]="'category-chip-' + cat.label"
          [class.active]="isCategoryActive(cat.value)"
          [attr.aria-pressed]="isCategoryActive(cat.value)"
          [attr.aria-current]="isCategoryActive(cat.value) ? 'true' : null"
          (click)="selectCategory(cat.value)"
        >
          <span class="category-glyph" aria-hidden="true">{{ cat.code }}</span>
          {{ cat.label }}
        </button>
      }
      @if (categoryError()) {
        <span class="category-error tech-font" role="alert" data-testid="category-error"
          >Failed to load categories</span
        >
      }
    </nav>
  `,
  styles: [
    `
      .catalog-hero {
        position: relative;
        min-height: 510px;
        display: flex;
        align-items: center;
        overflow: hidden;
        border: 1px solid var(--color-outline-variant);
        background-color: #0b0e0b;
        background-image:
          linear-gradient(
            90deg,
            rgba(8, 11, 8, 0.98) 0%,
            rgba(8, 11, 8, 0.88) 38%,
            rgba(8, 11, 8, 0.34) 72%,
            rgba(8, 11, 8, 0.18) 100%
          ),
          url('/assets/images/catalog-hero-hardware.svg');
        background-position: center;
        background-size: cover;
      }
      .hero-content {
        position: relative;
        z-index: 1;
        width: min(640px, 70%);
        padding: 56px 64px;
      }
      .system-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 24px;
        padding: 5px 9px;
        border-left: 2px solid var(--color-primary);
        background: rgba(11, 14, 11, 0.88);
        color: var(--color-primary);
        font-size: 9px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .system-badge::before {
        width: 5px;
        height: 5px;
        background: currentColor;
        content: '';
      }
      .system-error {
        color: var(--color-error);
        border-color: var(--color-error);
      }
      .hero-title {
        max-width: 620px;
        margin: 0 0 16px;
        color: #f4f5eb;
        font-size: clamp(42px, 5vw, 68px);
        font-weight: 800;
        line-height: 0.94;
        letter-spacing: -0.045em;
        text-transform: uppercase;
      }
      .hero-title span {
        color: var(--color-primary);
      }
      .hero-subtitle {
        max-width: 560px;
        margin: 0 0 24px;
        color: #bcc1aa;
        font-size: 14px;
        line-height: 1.55;
      }
      .hero-search {
        max-width: 560px;
        margin-bottom: 18px;
      }
      .search-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      .search-icon {
        position: absolute;
        left: 15px;
        width: 16px;
        height: 16px;
        color: var(--color-on-surface-variant);
        pointer-events: none;
      }
      .search-input {
        width: 100%;
        height: 48px;
        background-color: rgba(13, 16, 13, 0.96);
        border: 1px solid var(--color-outline-variant);
        color: var(--color-on-surface);
        padding: 0 44px;
        font-family: var(--font-mono);
        font-size: 10px;
        transition:
          border-color 0.2s,
          background-color 0.2s;
      }
      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        background-color: #101410;
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
      .search-clear svg {
        width: 16px;
        height: 16px;
      }
      .hero-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .hero-actions .btn {
        min-height: 42px;
        padding: 0 18px;
        font: 700 9px var(--font-mono);
        letter-spacing: 0.08em;
      }
      .hero-primary {
        gap: 24px;
      }
      .hero-secondary {
        border-color: #6c735f;
        background: rgba(13, 16, 13, 0.78);
      }
      .category-ribbon {
        display: flex;
        align-items: stretch;
        gap: 10px;
        overflow-x: auto;
        padding: 18px 0;
        border-bottom: 1px solid var(--color-border);
        scrollbar-width: none;
      }
      .category-ribbon::-webkit-scrollbar {
        display: none;
      }

      .category-label {
        display: inline-flex;
        align-items: center;
        padding-right: 12px;
        color: #7e856f;
        font-size: 8px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .category-chip {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        justify-content: center;
        padding: 12px 24px;
        background: #121412;
        border: 1px solid var(--color-outline-variant);
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }
      .category-glyph {
        font-size: 20px;
      }
      .category-chip:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        transform: translateY(-2px);
      }
      .category-chip.active,
      .category-chip[aria-pressed='true'] {
        background-color: #292a29;
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .category-error {
        color: var(--color-error);
        font-size: 12px;
        align-self: center;
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
      @media (max-width: 768px) {
        .catalog-hero {
          min-height: 520px;
          background-position: 58% center;
        }
        .catalog-hero {
          background-image:
            linear-gradient(rgba(8, 11, 8, 0.78), rgba(8, 11, 8, 0.96)),
            url('/assets/images/catalog-hero-hardware.svg');
        }
        .hero-content {
          width: 100%;
          padding: 46px 24px;
        }
        .hero-title {
          font-size: clamp(38px, 13vw, 54px);
        }
        .hero-subtitle {
          font-size: 13px;
        }
        .hero-actions .btn {
          flex: 1 1 180px;
        }
        .category-label {
          display: none;
        }
        .category-ribbon {
          margin-inline: -16px;
          padding-inline: 16px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogSearchComponent {
  private readonly queryService = inject(CatalogQueryService);
  private readonly categoryService = inject(CategoryService);
  readonly catalogStore = inject(CatalogStore);

  readonly categories = this.categoryService.categories;
  readonly categoryError = this.categoryService.error;

  // Track current search and category from the live query params stream
  private readonly queryParams = toSignal(this.queryService.queryParams$);

  readonly currentSearch = computed(() => this.queryParams()?.search ?? '');
  readonly currentCategory = computed(() => this.queryParams()?.category);
  readonly quickCategories = computed(() => {
    const available = this.categories();
    return [
      { label: 'CPU', code: 'P', value: this.findCategory(available, 'CPU') },
      { label: 'GPU', code: 'G', value: this.findCategory(available, 'GPU') },
      { label: 'RAM', code: 'M', value: this.findCategory(available, 'RAM') },
      { label: 'Motherboard', code: 'B', value: this.findCategory(available, 'Motherboard') },
    ];
  });

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

  isCategoryActive(category: string): boolean {
    return this.currentCategory()?.toLocaleLowerCase() === category.toLocaleLowerCase();
  }

  scrollToResults(): void {
    const el = document.getElementById('catalog-results');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.focus();
    }
  }

  private findCategory(categories: string[], label: string): string {
    return (
      categories.find((category) => category.toLocaleLowerCase() === label.toLocaleLowerCase()) ??
      label
    );
  }
}
