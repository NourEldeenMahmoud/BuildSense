import { Component, computed, input } from '@angular/core';
import type { RawSpecification } from '../../../shared/contracts/catalog';

// ---------------------------------------------------------------------------
// Normalized spec row — display label + per-side value
// ---------------------------------------------------------------------------

export interface NormalizedSpecRow {
  /** Original label from the API, preserved for display. */
  displayLabel: string;
  /** Left side value or null if absent. */
  leftValue: string | null;
  /** Right side value or null if absent. */
  rightValue: string | null;
  /** Whether both sides have different literal values. */
  differs: boolean;
}

// ---------------------------------------------------------------------------
// Normalization helpers — trim + case-fold only, no semantic inference
// ---------------------------------------------------------------------------

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * Compute the union of raw specification labels from two products,
 * preserving original API order.  For each label, match the value
 * from each side using whitespace/case-insensitive label comparison.
 * Display labels and values are always the originals.
 */
export function computeSpecUnion(
  leftSpecs: RawSpecification[],
  rightSpecs: RawSpecification[]
): NormalizedSpecRow[] {
  // Build normalized lookup for each side
  const leftMap = new Map<string, string>();
  for (const spec of leftSpecs) {
    leftMap.set(normalizeLabel(spec.label), spec.value);
  }

  const rightMap = new Map<string, string>();
  for (const spec of rightSpecs) {
    rightMap.set(normalizeLabel(spec.label), spec.value);
  }

  // Union in left-first order, then append right-only labels
  const seenLabels = new Set<string>();
  const rows: NormalizedSpecRow[] = [];

  // Walk left specs in order
  for (const spec of leftSpecs) {
    const key = normalizeLabel(spec.label);
    if (seenLabels.has(key)) continue;
    seenLabels.add(key);

    const leftValue = spec.value || null;
    const rightValue = rightMap.get(key) || null;

    rows.push({
      displayLabel: spec.label,
      leftValue,
      rightValue,
      differs: leftValue !== rightValue,
    });
  }

  // Append right-only specs
  for (const spec of rightSpecs) {
    const key = normalizeLabel(spec.label);
    if (seenLabels.has(key)) continue;
    seenLabels.add(key);

    rows.push({
      displayLabel: spec.label,
      leftValue: null,
      rightValue: spec.value || null,
      differs: true,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'bs-compare-spec-matrix',
  standalone: true,
  template: `
    @if (isEmpty()) {
      <div class="matrix-empty" role="status">
        <p class="matrix-empty-text tech-font">No comparable specifications available</p>
      </div>
    } @else {
      <section class="matrix-section" aria-label="Specification comparison">
        <h2 class="matrix-heading">Specifications</h2>
        <div class="matrix-grid">
          <section class="spec-card" [attr.aria-label]="'Specifications for ' + (leftProductName() || 'Product A')">
            <header class="spec-card-header tech-font">
              <span>Core Specifications</span>
              <span>Slot_A</span>
            </header>
            @for (row of rows(); track row.displayLabel) {
              <div class="spec-row" [class.spec-row-differs]="row.differs">
                <span class="spec-label tech-font">{{ row.displayLabel }}</span>
                @if (row.leftValue !== null) {
                  <span class="spec-value tech-font">{{ row.leftValue }}</span>
                } @else {
                  <span class="spec-value matrix-missing tech-font" aria-label="Not available for left product">\u2014</span>
                }
              </div>
            }
          </section>

          <section class="spec-card" [attr.aria-label]="'Specifications for ' + (rightProductName() || 'Product B')">
            <header class="spec-card-header tech-font">
              <span>Core Specifications</span>
              <span>Slot_B</span>
            </header>
            @for (row of rows(); track row.displayLabel) {
              <div class="spec-row" [class.spec-row-differs]="row.differs">
                <span class="spec-label tech-font">{{ row.displayLabel }}</span>
                @if (row.rightValue !== null) {
                  <span class="spec-value tech-font">{{ row.rightValue }}</span>
                } @else {
                  <span class="spec-value matrix-missing tech-font" aria-label="Not available for right product">\u2014</span>
                }
              </div>
            }
          </section>
        </div>
      </section>
    }
  `,
  styles: [`
    .matrix-section {
      margin-top: 8px;
    }
    .matrix-heading {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 18px;
      color: var(--color-on-surface);
      text-transform: uppercase;
      letter-spacing: -0.01em;
    }
    .matrix-grid {
      position: relative;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-gutter);
    }
    .matrix-grid::after {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 1px;
      background: rgba(68, 73, 51, 0.3);
      content: '';
      transform: translateX(-50%);
    }
    .spec-card {
      min-width: 0;
      border: 1px solid rgba(68, 73, 51, 0.55);
      background: var(--color-surface);
    }
    .spec-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 38px;
      padding: 9px 14px;
      border-bottom: 1px solid rgba(68, 73, 51, 0.6);
      background: var(--color-surface-container);
      color: var(--color-on-surface);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }
    .spec-card-header span:last-child {
      color: var(--color-outline);
      font-weight: 400;
    }
    .spec-row {
      display: grid;
      grid-template-columns: minmax(120px, 0.38fr) minmax(0, 0.62fr);
      align-items: baseline;
      gap: 20px;
      min-height: 48px;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(68, 73, 51, 0.32);
    }
    .spec-row:last-child { border-bottom: 0; }
    .spec-row-differs { background: rgba(199, 243, 0, 0.035); }
    .spec-label {
      color: var(--color-on-surface-variant);
      font-size: 14px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .spec-value {
      color: var(--color-on-surface);
      font-size: 14px;
      font-weight: 700;
      line-height: 1.5;
      text-align: right;
      overflow-wrap: anywhere;
    }
    .matrix-missing {
      color: var(--color-on-surface-variant);
      opacity: 0.5;
    }
    .matrix-empty {
      padding: var(--space-gutter);
      text-align: center;
      background-color: var(--color-surface-container-low);
      border: var(--border-width) solid var(--color-border);
    }
    .matrix-empty-text {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }

    @media (max-width: 767px) {
      .matrix-heading { font-size: 21px; }
      .matrix-grid { grid-template-columns: 1fr; }
      .matrix-grid::after { display: none; }
      .spec-row { grid-template-columns: minmax(100px, 0.42fr) minmax(0, 0.58fr); gap: 12px; }
      .spec-label, .spec-value { font-size: 14px; }
    }
  `],
})
export class CompareSpecMatrixComponent {
  readonly leftSpecs = input<RawSpecification[]>([]);
  readonly rightSpecs = input<RawSpecification[]>([]);
  readonly leftProductName = input<string>('');
  readonly rightProductName = input<string>('');

  readonly rows = computed(() =>
    computeSpecUnion(this.leftSpecs(), this.rightSpecs())
  );

  readonly isEmpty = computed(
    () => this.leftSpecs().length === 0 && this.rightSpecs().length === 0
  );
}
