import { Component } from '@angular/core';
import type { RawSpecification } from '../../../shared/contracts/catalog';

@Component({
  selector: 'app-product-specs',
  standalone: true,
  inputs: ['specs'],
  template: `
    @if (specs && specs.length > 0) {
      <section class="specs-section" aria-label="Raw specifications">
        <h2 class="specs-heading">Specifications</h2>
        <dl class="specs-list">
          @for (spec of specs; track spec._id ?? spec.label + spec.value; let idx = $index) {
            <div class="spec-row" [attr.data-spec-index]="idx">
              <dt class="spec-label tech-font">{{ spec.label }}</dt>
              <dd class="spec-value">{{ spec.value || '\u2014' }}</dd>
            </div>
          }
        </dl>
      </section>
    } @else {
      <section class="specs-section specs-empty" aria-label="Raw specifications">
        <h2 class="specs-heading">Specifications</h2>
        <p class="specs-empty-text tech-font">No specifications available.</p>
      </section>
    }
  `,
  styles: [`
    .specs-section {
      margin-top: var(--space-gutter);
    }
    .specs-heading {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--color-on-surface);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .specs-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
    }
    .spec-row {
      display: grid;
      grid-template-columns: minmax(140px, 1fr) 2fr;
      gap: 16px;
      padding: 10px 0;
      border-bottom: var(--border-width) solid var(--color-border);
      align-items: baseline;
    }
    .spec-row:last-child {
      border-bottom: none;
    }
    .spec-label {
      font-size: 12px;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      word-break: break-word;
      margin: 0;
    }
    .spec-value {
      font-size: 14px;
      color: var(--color-on-surface);
      word-break: break-word;
      margin: 0;
    }
    .specs-empty-text {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    @media (max-width: 767px) {
      .spec-row {
        grid-template-columns: 1fr;
        gap: 4px;
        padding: 12px 0;
      }
      .spec-label {
        font-size: 11px;
      }
      .spec-value {
        font-size: 14px;
      }
    }
  `],
})
export class ProductSpecsComponent {
  specs: RawSpecification[] = [];
}
