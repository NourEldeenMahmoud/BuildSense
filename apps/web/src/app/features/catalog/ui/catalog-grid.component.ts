import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogStore } from '../data-access/catalog.store';
import { CatalogProductCardComponent } from './catalog-product-card.component';
import { ErrorStateComponent } from '../../../shared/components/error-state.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { AriaLiveComponent } from '../../../shared/components/aria-live.component';

@Component({
  selector: 'app-catalog-grid',
  standalone: true,
  imports: [
    CommonModule,
    CatalogProductCardComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    AriaLiveComponent,
  ],
  template: `
    <!-- Aria live for result changes -->
    <app-aria-live [message]="resultAnnouncement()" politeness="polite"></app-aria-live>

    <!-- Background loading bar -->
    @if (catalogStore.backgroundLoading()) {
      <div class="loading-bar" role="status" aria-label="Updating results...">
        <div class="loading-bar-inner"></div>
      </div>
    }

    <!-- Initial skeleton loading (retained grid on background error) -->
    @if (catalogStore.initialLoading()) {
      <div class="product-grid" aria-busy="true" aria-label="Loading products">
        @for (n of skeletonItems; track n) {
          <div class="skeleton-card" aria-hidden="true">
            <div class="skeleton-image"></div>
            <div class="skeleton-body">
              <div class="skeleton-line short"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line medium"></div>
              <div class="skeleton-line short"></div>
            </div>
          </div>
        }
      </div>
    }

    <!-- Error state (with retained grid if background error) -->
    @else if (catalogStore.error()) {
      @if (catalogStore.result()) {
        <!-- Background error: keep the stale grid visible -->
        <div class="bg-error-banner tech-font" role="alert" data-testid="bg-error-banner">
          Could not update results. {{ catalogStore.error() }}
          <button class="bg-error-retry" type="button" (click)="retry()">Retry</button>
        </div>
        <div
          class="product-grid bg-loading"
          role="list"
          [attr.aria-label]="'Product results, ' + catalogStore.result()!.items.length + ' items'"
        >
          @for (product of catalogStore.result()!.items; track product.id) {
            <div role="listitem">
              <app-catalog-product-card [product]="product"></app-catalog-product-card>
            </div>
          }
        </div>
      } @else {
        <app-error-state
          title="Failed to load products"
          [message]="catalogStore.error()!"
          [showRetry]="true"
          (onRetry)="retry()"
        >
        </app-error-state>
      }
    }

    <!-- Empty state -->
    @else if (catalogStore.empty()) {
      <app-empty-state
        title="No products found"
        message="Try adjusting your search or filters to find what you're looking for."
      >
      </app-empty-state>
    }

    <!-- Product grid -->
    @else if (catalogStore.result()) {
      <div
        #gridRef
        class="product-grid"
        data-testid="product-grid"
        [class.bg-loading]="catalogStore.backgroundLoading()"
        role="list"
        [attr.aria-label]="'Product results, ' + catalogStore.result()!.items.length + ' items'"
      >
        @for (product of catalogStore.result()!.items; track product.id) {
          <div role="listitem">
            <app-catalog-product-card [product]="product"></app-catalog-product-card>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .loading-bar {
        height: 2px;
        background: var(--color-surface-container);
        overflow: hidden;
        margin-bottom: 16px;
      }
      .loading-bar-inner {
        height: 100%;
        background: var(--color-primary);
        animation: progress 1.5s infinite ease-in-out;
      }
      @keyframes progress {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(200%);
        }
      }
      .product-grid {
        display: grid;
        grid-template-columns: repeat(1, 1fr);
        gap: 24px;
        width: 100%;
        min-width: 0;
        transition: opacity 0.2s;
      }
      .product-grid > [role='listitem'] {
        min-width: 0;
      }
      @media (min-width: 640px) {
        .product-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (min-width: 1024px) {
        .product-grid {
          grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
        }
      }
      .product-grid.bg-loading {
        opacity: 0.7;
      }
      .skeleton-card {
        background: var(--color-surface-container);
        border: 1px solid var(--color-border);
      }
      .skeleton-image {
        width: 100%;
        aspect-ratio: 4 / 3;
        background: var(--color-surface-container-high);
        animation: pulse 1.5s infinite ease-in-out;
      }
      .skeleton-body {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .skeleton-line {
        height: 12px;
        background: var(--color-surface-container-high);
        animation: pulse 1.5s infinite ease-in-out;
      }
      .skeleton-line.short {
        width: 40%;
      }
      .skeleton-line.medium {
        width: 70%;
      }
      .bg-error-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        background: var(--color-error-container, #fce4e4);
        color: var(--color-on-error-container, #8b1a1a);
        font-size: 12px;
        margin-bottom: 16px;
      }
      .bg-error-retry {
        background: transparent;
        border: 1px solid currentColor;
        color: inherit;
        font-family: var(--font-mono);
        font-size: 11px;
        text-transform: uppercase;
        padding: 4px 10px;
        cursor: pointer;
        margin-left: auto;
        transition: background 0.2s;
      }
      .bg-error-retry:hover {
        background: rgba(0, 0, 0, 0.1);
      }
      @keyframes pulse {
        0% {
          opacity: 1;
        }
        50% {
          opacity: 0.4;
        }
        100% {
          opacity: 1;
        }
      }
      @media (max-width: 560px) {
        .product-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogGridComponent {
  readonly catalogStore = inject(CatalogStore);

  readonly skeletonItems = Array.from({ length: 12 }, (_, i) => i);

  readonly resultAnnouncement = computed(() => {
    const result = this.catalogStore.result();
    if (this.catalogStore.initialLoading()) return 'Loading products...';
    if (this.catalogStore.error()) return 'Error loading products. ' + this.catalogStore.error();
    if (this.catalogStore.empty()) return 'No products found.';
    if (result) {
      const { page, totalItems, pageSize } = result.pagination;
      const start = (page - 1) * pageSize + 1;
      const end = Math.min(page * pageSize, totalItems);
      return `Showing ${start} to ${end} of ${totalItems} products.`;
    }
    return '';
  });

  retry(): void {
    this.catalogStore.retry();
  }
}
