import { Component } from '@angular/core';
import type { RawSpecification } from '../../../shared/contracts/catalog';

@Component({
  selector: 'app-product-specs',
  standalone: true,
  inputs: ['specs'],
  template: `
    @if (specs && specs.length > 0) {
      <section class="specs-section" aria-label="Raw specifications">
        <h2 class="specs-heading">
          <span class="material-symbols-outlined" aria-hidden="true">data_object</span>
          Technical Specifications
        </h2>
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
        <h2 class="specs-heading">
          <span class="material-symbols-outlined" aria-hidden="true">data_object</span>
          Technical Specifications
        </h2>
        <p class="specs-empty-text tech-font">No specifications available.</p>
      </section>
    }
  `,
  styles: [`
    .specs-section {
      padding-top: 44px;
      border-top: 1px solid rgba(68, 73, 51, 0.7);
    }
    .specs-heading {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 24px;
      color: var(--color-on-surface);
    }
    .specs-heading .material-symbols-outlined {
      color: var(--color-primary);
      font-size: 22px;
    }
    .specs-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
      margin: 0;
      border-top: 1px solid rgba(68, 73, 51, 0.55);
      border-left: 1px solid rgba(68, 73, 51, 0.55);
    }
    .spec-row {
      min-width: 0;
      min-height: 88px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      padding: 13px 14px;
      border-right: 1px solid rgba(68, 73, 51, 0.55);
      border-bottom: 1px solid rgba(68, 73, 51, 0.55);
      background: var(--color-surface-container);
    }
    .spec-row:nth-child(even) {
      background: var(--color-surface-container-low);
    }
    .spec-label {
      font-family: var(--font-primary);
      font-size: 14px;
      line-height: 1.4;
      color: var(--color-on-surface-variant);
      word-break: break-word;
      margin: 0;
    }
    .spec-value {
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 700;
      line-height: 1.4;
      color: var(--color-primary);
      text-align: right;
      word-break: break-word;
      margin: 0;
    }
    .specs-empty-text {
      font-size: 14px;
      color: var(--color-on-surface-variant);
    }
    @media (max-width: 767px) {
      .specs-section {
        padding-top: 32px;
      }
      .specs-heading {
        font-size: 21px;
      }
      .specs-list {
        grid-template-columns: 1fr;
      }
      .spec-row {
        min-height: 72px;
        gap: 8px;
        padding: 12px;
      }
      .spec-label {
        font-size: 13px;
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
