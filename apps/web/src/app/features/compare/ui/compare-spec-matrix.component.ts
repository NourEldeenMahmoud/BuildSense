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
        <div class="matrix-scroll-container" tabindex="0" role="region" aria-label="Scrollable specification comparison table">
          <table class="matrix-table">
            <thead>
              <tr>
                <th class="matrix-label-col" scope="col">Specification</th>
                <th class="matrix-value-col" scope="col">{{ leftProductName() || 'Product A' }}</th>
                <th class="matrix-value-col" scope="col">{{ rightProductName() || 'Product B' }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.displayLabel) {
                <tr [class.matrix-row-differs]="row.differs">
                  <th class="matrix-label-cell tech-font" scope="row">{{ row.displayLabel }}</th>
                  <td class="matrix-value-cell">
                    @if (row.leftValue !== null) {
                      {{ row.leftValue }}
                    } @else {
                      <span class="matrix-missing" aria-label="Not available for left product">\u2014</span>
                    }
                  </td>
                  <td class="matrix-value-cell">
                    @if (row.rightValue !== null) {
                      {{ row.rightValue }}
                    } @else {
                      <span class="matrix-missing" aria-label="Not available for right product">\u2014</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
  styles: [`
    .matrix-section {
      margin-top: var(--space-gutter);
    }
    .matrix-heading {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--color-on-surface);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .matrix-scroll-container {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 600px;
    }
    .matrix-label-col {
      width: 30%;
      text-align: left;
      font-size: 12px;
      font-family: var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--color-on-surface-variant);
      padding: 10px 12px 10px 0;
      border-bottom: var(--border-width) solid var(--color-border);
      font-weight: 400;
    }
    .matrix-value-col {
      width: 35%;
      text-align: left;
      font-size: 12px;
      font-family: var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--color-on-surface-variant);
      padding: 10px 12px;
      border-bottom: var(--border-width) solid var(--color-border);
      font-weight: 400;
    }
    .matrix-label-cell {
      font-size: 12px;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 10px 12px 10px 0;
      border-bottom: var(--border-width) solid var(--color-border);
      font-weight: 400;
      text-align: left;
      vertical-align: baseline;
      word-break: break-word;
    }
    .matrix-value-cell {
      font-size: 14px;
      color: var(--color-on-surface);
      padding: 10px 12px;
      border-bottom: var(--border-width) solid var(--color-border);
      vertical-align: baseline;
      word-break: break-word;
    }
    .matrix-row-differs .matrix-value-cell {
      background-color: var(--color-surface-container);
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

    /* Responsive — stacked view for mobile */
    @media (max-width: 767px) {
      .matrix-table {
        min-width: unset;
      }
      .matrix-label-col,
      .matrix-value-col {
        font-size: 11px;
        padding: 8px;
      }
      .matrix-label-cell,
      .matrix-value-cell {
        font-size: 13px;
        padding: 8px;
      }
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
