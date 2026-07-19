import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CatalogProductListItem } from '../../../shared/contracts/catalog';

/**
 * Known category terms used for presentation-only label correction.
 * Only exact substring matches are applied; ambiguous cases are left as-is.
 */
const COOLING_TITLE_SIGNALS = [
  'cooler',
  'cooling',
  'aio',
  'liquid',
  'radiator',
  'heat sink',
  'heatsink',
  'fan',
  'water block',
];

function isLikelyCooling(product: CatalogProductListItem): boolean {
  if (product.category !== 'MONITOR') return false;
  const haystack = (
    (product.title ?? '') + ' ' + (product.model ?? '')
  ).toLowerCase();
  return COOLING_TITLE_SIGNALS.some((signal) => haystack.includes(signal));
}

const SPECIFICATION_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /socket/, label: 'Socket' },
  { pattern: /wattage|rated power|power output/, label: 'Wattage' },
  { pattern: /radiator.*size|radiator/, label: 'Radiator Size' },
  { pattern: /fan.*size|fan diameter/, label: 'Fan Size' },
  { pattern: /form factor/, label: 'Form Factor' },
  { pattern: /cooler.*type|cooling.*type/, label: 'Cooler Type' },
  { pattern: /capacity|memory size/, label: 'Capacity' },
  { pattern: /speed|frequency|clock/, label: 'Speed' },
  { pattern: /^cores?$/, label: 'Cores' },
  { pattern: /^threads?$/, label: 'Threads' },
  { pattern: /resolution/, label: 'Resolution' },
  { pattern: /refresh rate/, label: 'Refresh Rate' },
  { pattern: /screen size|display size/, label: 'Screen Size' },
];

const CATEGORY_SPECIFICATION_PRIORITY: Record<string, readonly string[]> = {
  CPU: ['Socket', 'Cores', 'Threads', 'Speed'],
  GPU: ['Capacity', 'Speed'],
  MOTHERBOARD: ['Socket', 'Form Factor', 'Speed'],
  RAM: ['Capacity', 'Speed'],
  SSD: ['Capacity', 'Speed', 'Form Factor'],
  HDD: ['Capacity', 'Speed', 'Form Factor'],
  STORAGE: ['Capacity', 'Speed', 'Form Factor'],
  PSU: ['Wattage', 'Form Factor'],
  CASE: ['Form Factor', 'Fan Size'],
  COOLING: ['Cooler Type', 'Radiator Size', 'Fan Size'],
  MONITOR: ['Screen Size', 'Resolution', 'Refresh Rate'],
};

function friendlySpecificationLabel(label: string, category: string): string | null {
  const normalized = label.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized === 'type' && category === 'COOLING') return 'Cooler Type';
  if (normalized === 'type' && category === 'CASE') return 'Form Factor';
  if (normalized === 'memory' && category === 'GPU') return 'Capacity';
  return SPECIFICATION_LABELS.find(({ pattern }) => pattern.test(normalized))?.label ?? null;
}

/**
 * Bundle badge: The CatalogProductListItem response has no `isBundle` field.
 * The badge is omitted per Stage 4 requirements: do not infer bundle status from title.
 * Limitation documented. Will be re-evaluated if the backend adds a dedicated field.
 */
@Component({
  selector: 'app-catalog-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  inputs: ['product'],
  template: `
    <article class="product-card">
      <a
        [routerLink]="['/products', product.id]"
        class="card-link"
        [attr.aria-label]="'View ' + product.title"
      ></a>

      <!-- Top status bar -->
      <div class="card-status" [ngClass]="statusClass()">
        <span class="status-label">{{ statusLabel() }}</span>
        <span class="material-symbols-outlined bookmark-icon" aria-hidden="true">bookmark_add</span>
      </div>

      <!-- Product image -->
      <div class="product-image-wrapper">
        @if (imageUrl && !imageError) {
          <img
            class="product-image"
            [src]="imageUrl"
            [alt]="product.title"
            loading="lazy"
            (error)="imageError = true"
          />
        } @else {
          <div
            class="product-image-fallback"
            role="img"
            [attr.aria-label]="product.title + ' (no image)'"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
        }
      </div>

      <!-- Content panel -->
      <div class="product-content">
        <!-- Brand -->
        @if (product.brand) {
          <span class="product-brand">{{ product.brand }}</span>
        }

        <!-- Title / model -->
        <h3 class="product-title" [attr.title]="product.title">{{ product.title }}</h3>

        <!-- Category (corrected display) -->
        <span class="product-category">{{ displayCategory() }}</span>

        <!-- Specification rows -->
        @if (visibleSpecifications.length > 0) {
          <div class="spec-table">
            @for (spec of visibleSpecifications; track spec.label) {
              <div class="spec-row">
                <span class="spec-label">{{ spec.label }}</span>
                <span class="spec-value">{{ spec.value }}</span>
              </div>
            }
          </div>
        }

        <!-- Price -->
        <div class="product-price">
          @if (product.price !== null && product.price !== undefined) {
            <span class="price-amount" [attr.aria-label]="product.price + ' ' + product.currency">
              {{ product.price | number: '1.0-0' }}<span class="price-currency">{{ product.currency }}</span>
            </span>
          } @else {
            <span class="price-unknown" aria-label="Price unavailable">Price unavailable</span>
          }
        </div>
      </div>

      <!-- Hover action overlay -->
      <div class="hover-actions">
        <a [routerLink]="['/products', product.id]" class="hover-btn-primary">Add to Build</a>
        @if (product.sourceUrl) {
          <a
            [href]="product.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="hover-btn-external"
            aria-label="View on store"
          >
            <svg
              class="external-icon"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        }
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        height: 100%;
      }

      /* ── Card shell ─────────────────────────────── */
      .product-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-width: 0;
        position: relative;
        overflow: hidden;
        background: #1a1a1a;
        border: 1px solid #333333;
        transition:
          border-color 0.25s ease,
          box-shadow 0.25s ease;
      }
      .product-card:hover,
      .product-card:focus-within {
        border-color: #55594d;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.32);
      }
      .card-link {
        position: absolute;
        inset: 0;
        z-index: 2;
      }
      .card-link:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -3px;
      }

      /* ── Status bar ─────────────────────────────── */
      .card-status {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 40px;
        padding: 8px 16px;
        border-bottom: 1px solid #2a2a2a;
        background: #141414;
        color: #888;
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .status-label {
        display: inline-flex;
        align-items: center;
      }
      .bookmark-icon {
        font-size: 18px;
        color: #666;
        transition: color 0.2s;
        pointer-events: none;
      }
      .card-status.in-stock {
        color: var(--color-primary);
      }
      .card-status.out-of-stock {
        color: var(--color-error);
      }
      .card-status.status-caution {
        color: #ffb4ab;
      }

      /* ── Image area ─────────────────────────────── */
      .product-image-wrapper {
        position: relative;
        width: 100%;
        aspect-ratio: 4 / 3;
        background: #111111;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(20px, 7%, 30px);
        overflow: hidden;
        flex-shrink: 0;
      }
      .product-image {
        width: 100%;
        height: 100%;
        max-width: 88%;
        max-height: 88%;
        object-fit: contain;
        transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        position: relative;
        z-index: 1;
      }
      .product-card:hover .product-image {
        transform: scale(1.04);
      }
      .product-image-fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #444;
        opacity: 0.4;
      }
      .product-image-fallback svg {
        width: 40px;
        height: 40px;
      }

      /* ── Content panel ──────────────────────────── */
      .product-content {
        display: flex;
        flex-direction: column;
        flex: 1;
        padding: 18px 20px 20px;
        border-top: 1px solid #333333;
        background: #1a1a1a;
        gap: 0;
      }

      .product-brand {
        display: block;
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 400;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: #777;
        margin-bottom: 6px;
      }

      .product-title {
        font-family: var(--font-primary);
        font-size: clamp(18px, 1.45vw, 22px);
        font-weight: 700;
        line-height: 1.24;
        text-transform: uppercase;
        text-wrap: pretty;
        overflow-wrap: break-word;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        /* autoprefixer: ignore next */
        -webkit-box-orient: vertical;
        color: var(--color-on-surface);
        margin: 0 0 6px;
        transition: color 0.2s ease;
      }
      .product-card:hover .product-title {
        color: #f4f5ed;
      }

      .product-category {
        display: block;
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-primary);
        margin-bottom: 14px;
      }

      /* ── Spec table (inset bordered rows) ───────── */
      .spec-table {
        border: 1px solid #333333;
        margin: 2px 0 18px;
      }
      .spec-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 36px;
        padding: 7px 12px;
        background: #141414;
      }
      .spec-row + .spec-row {
        border-top: 1px solid #333333;
      }
      .spec-label {
        font-family: var(--font-mono);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #888;
        padding-right: 12px;
      }
      .spec-value {
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 400;
        color: var(--color-on-surface);
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
        max-width: 55%;
      }

      /* ── Price ──────────────────────────────────── */
      .product-price {
        display: flex;
        align-items: baseline;
        gap: 4px;
        min-height: 32px;
        margin-top: auto;
      }
      .price-amount {
        font-family: var(--font-primary);
        font-size: 26px;
        font-weight: 700;
        color: var(--color-on-surface);
        line-height: 1.2;
      }
      .price-currency {
        font-size: 13px;
        font-weight: 400;
        color: #777;
        margin-left: 2px;
      }
      .price-unknown {
        font-family: var(--font-mono);
        font-size: 14px;
        font-weight: 400;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      /* ── Hover overlay actions ──────────────────── */
      .hover-actions {
        position: absolute;
        top: 40px;
        left: 0;
        width: 100%;
        padding: 12px 16px;
        background: rgba(20, 20, 20, 0.96);
        backdrop-filter: blur(4px);
        border-bottom: 1px solid var(--color-primary);
        opacity: 0;
        pointer-events: none;
        transform: translateY(-5px);
        transition:
          transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
          opacity 0.18s ease;
        display: flex;
        gap: 8px;
        z-index: 10;
      }
      .product-card:hover .hover-actions,
      .product-card:focus-within .hover-actions {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      .hover-btn-primary {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 10px 16px;
        background: var(--color-primary);
        color: var(--color-on-primary);
        text-decoration: none;
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        transition: background 0.2s;
        flex: 1;
      }
      .hover-btn-primary:hover,
      .hover-btn-primary:focus-visible {
        background: var(--color-primary-container);
        outline: none;
      }
      .hover-btn-external {
        width: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #555;
        color: #999;
        transition:
          border-color 0.2s ease,
          color 0.2s ease;
      }
      .hover-btn-external:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .external-icon {
        width: 14px;
        height: 14px;
      }

      .source-link {
        display: none;
      }

      @media (max-width: 480px) {
        .product-content {
          padding: 16px 18px 18px;
        }
        .product-title {
          font-size: 19px;
        }
        .price-amount {
          font-size: 24px;
        }
      }

      @media (hover: none) {
        .hover-actions {
          opacity: 1;
          pointer-events: auto;
          transform: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .product-card,
        .product-image,
        .hover-actions {
          transition: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogProductCardComponent {
  product!: CatalogProductListItem;
  imageError = false;

  get imageUrl(): string | null {
    return this.product.images?.length ? this.product.images[0]! : null;
  }

  get visibleSpecifications(): Array<{ label: string; value: string }> {
    const category = this.product.category.toUpperCase();
    const priorities = CATEGORY_SPECIFICATION_PRIORITY[category] ?? [];
    const candidates = (this.product.cardSpecifications ?? [])
      .map((spec) => ({ ...spec, friendlyLabel: friendlySpecificationLabel(spec.label, category) }))
      .filter(
        (spec): spec is typeof spec & { friendlyLabel: string } =>
          spec.friendlyLabel !== null && spec.value.trim().length > 0,
      );

    const result: Array<{ label: string; value: string }> = [];
    for (const label of priorities) {
      const match = candidates.find((spec) => spec.friendlyLabel === label);
      if (match && !result.some((spec) => spec.label === label)) {
        result.push({ label, value: match.value });
      }
      if (result.length === 2) break;
    }
    return result;
  }

  get availabilityLabel(): string {
    switch (this.product.availability) {
      case 'IN_STOCK':
        return 'In stock';
      case 'OUT_OF_STOCK':
        return 'Out of stock';
      case 'PREORDER':
        return 'Pre-order';
      default:
        return 'Availability unknown';
    }
  }

  statusLabel(): string {
    return this.availabilityLabel;
  }

  statusClass(): string {
    switch (this.product.availability) {
      case 'IN_STOCK':
        return 'in-stock';
      case 'OUT_OF_STOCK':
        return 'out-of-stock out-of-stock-badge';
      default:
        return 'status-caution';
    }
  }

  /**
   * Presentation-only category label. Corrects obviously misclassified
   * cooling products (persisted as MONITOR) using high-confidence title/model
   * signals. Does not reclassify ambiguous records.
   */
  displayCategory(): string {
    return isLikelyCooling(this.product) ? 'COOLING' : this.product.category;
  }
}
