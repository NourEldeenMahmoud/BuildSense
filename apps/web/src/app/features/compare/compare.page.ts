import { Component, ChangeDetectionStrategy, inject, Signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ErrorStateComponent } from '../../shared/components/error-state.component';

export type CompareState = 
  | 'MISSING_IDS'
  | 'MALFORMED_LEFT'
  | 'MALFORMED_RIGHT'
  | 'DUPLICATE_IDS'
  | 'VALID';

@Component({
  selector: 'bs-compare-page',
  standalone: true,
  imports: [CommonModule, ErrorStateComponent],
  template: `
    <main class="compare-page">
      <h1>Product Comparison</h1>

      @switch (state()) {
        @case ('MISSING_IDS') {
          <app-error-state 
            title="Missing Products" 
            message="Please select two products to compare.">
          </app-error-state>
        }
        @case ('MALFORMED_LEFT') {
          <app-error-state 
            title="Invalid Left Product" 
            message="The left product ID is malformed.">
          </app-error-state>
        }
        @case ('MALFORMED_RIGHT') {
          <app-error-state 
            title="Invalid Right Product" 
            message="The right product ID is malformed.">
          </app-error-state>
        }
        @case ('DUPLICATE_IDS') {
          <app-error-state 
            title="Duplicate Products" 
            message="Cannot compare a product with itself.">
          </app-error-state>
        }
        @case ('VALID') {
          <div class="placeholder-state" data-testid="valid-compare-placeholder">
            <p>Comparison presentation for {{ leftId() }} and {{ rightId() }} will be implemented in Stage 6.</p>
          </div>
        }
      }
    </main>
  `,
  styles: [`
    .compare-page {
      padding: var(--spacing-4);
      max-width: 1200px;
      margin: 0 auto;
    }
    .placeholder-state {
      padding: var(--spacing-8);
      text-align: center;
      background-color: var(--surface-secondary);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComparePage {
  private route = inject(ActivatedRoute);
  private queryParams = toSignal(this.route.queryParams);

  leftId = computed(() => this.queryParams()?.[`left`]);
  rightId = computed(() => this.queryParams()?.[`right`]);

  state: Signal<CompareState> = computed(() => {
    const left = this.leftId();
    const right = this.rightId();

    if (!left || !right) {
      return 'MISSING_IDS';
    }

    if (!this.isValidId(left)) {
      return 'MALFORMED_LEFT';
    }

    if (!this.isValidId(right)) {
      return 'MALFORMED_RIGHT';
    }

    if (left.toLowerCase() === right.toLowerCase()) {
      return 'DUPLICATE_IDS';
    }

    return 'VALID';
  });

  private isValidId(id: string): boolean {
    return typeof id === 'string' && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
  }
}
