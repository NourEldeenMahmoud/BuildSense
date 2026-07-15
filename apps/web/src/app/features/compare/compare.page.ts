import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CompareStore } from './data-access/compare.store';
import { CompareHeadersComponent } from './ui/compare-headers.component';
import { CompareSpecMatrixComponent } from './ui/compare-spec-matrix.component';
import { CompareSelectorComponent } from './ui/compare-selector.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';

@Component({
  selector: 'bs-compare-page',
  standalone: true,
  providers: [CompareStore],
  imports: [
    CommonModule,
    CompareHeadersComponent,
    CompareSpecMatrixComponent,
    CompareSelectorComponent,
    ErrorStateComponent,
  ],
  template: `
    <section class="compare-page app-container" role="region" aria-label="Product comparison">
      <!-- Query validation states -->
      @switch (compare.queryState()) {
        @case ('missing') {
          <app-error-state
            title="Missing Products"
            message="Please select two products to compare. You can start from a product details page.">
          </app-error-state>
        }
        @case ('malformed-left') {
          <app-error-state
            title="Invalid Left Product"
            message="The left product ID in the URL is malformed. Please navigate to a valid comparison URL.">
          </app-error-state>
        }
        @case ('malformed-right') {
          <app-error-state
            title="Invalid Right Product"
            message="The right product ID in the URL is malformed. Please navigate to a valid comparison URL.">
          </app-error-state>
        }
        @case ('duplicates') {
          <app-error-state
            title="Duplicate Products"
            message="Cannot compare a product with itself. Please select two different products.">
          </app-error-state>
        }
        @case ('valid') {
          <!-- Loading state -->
          @if (compare.loading()) {
            <h1 class="compare-heading">Product Comparison</h1>
            <bs-compare-headers [loading]="true" [leftVm]="null" [rightVm]="null"></bs-compare-headers>
          }

          <!-- Error states for individual products -->
          @if (compare.leftNotFound()) {
            <app-error-state
              title="Left Product Not Found"
              [message]="compare.leftErrorMessage() || 'Product not found.'">
            </app-error-state>
          }
          @if (compare.leftApiError()) {
            <app-error-state
              title="Error Loading Left Product"
              [message]="compare.leftErrorMessage() || 'Failed to load product.'"
              [showRetry]="true"
              (onRetry)="compare.retry()">
            </app-error-state>
          }
          @if (compare.rightNotFound()) {
            <app-error-state
              title="Right Product Not Found"
              [message]="compare.rightErrorMessage() || 'Product not found.'">
            </app-error-state>
          }
          @if (compare.rightApiError()) {
            <app-error-state
              title="Error Loading Right Product"
              [message]="compare.rightErrorMessage() || 'Failed to load product.'"
              [showRetry]="true"
              (onRetry)="compare.retry()">
            </app-error-state>
          }

          <!-- Category mismatch -->
          @if (compare.categoryMismatch()) {
            <app-error-state
              title="Cross-Category Comparison"
              message="These products are from different categories and cannot be compared directly. Please select two products from the same category.">
            </app-error-state>
          }

          <!-- Valid comparison with both products loaded -->
          @if (compare.loaded() && !compare.categoryMismatch()) {
            <h1 class="compare-heading">Product Comparison</h1>

            <!-- Product headers -->
            <bs-compare-headers
              [leftVm]="compare.leftVm()"
              [rightVm]="compare.rightVm()"
              [loading]="false"
              (onChangeClick)="openSelectorFor($event)">
            </bs-compare-headers>

            <!-- Specification matrix -->
            <bs-compare-spec-matrix
              [leftSpecs]="compare.leftRaw()?.rawSpecifications ?? []"
              [rightSpecs]="compare.rightRaw()?.rawSpecifications ?? []"
              [leftProductName]="compare.leftVm()?.title ?? ''"
              [rightProductName]="compare.rightVm()?.title ?? ''">
            </bs-compare-spec-matrix>
          }
        }
      }

      <!-- Selector overlay -->
      <bs-compare-selector
        [isOpen]="selectorOpen()"
        [category]="selectorCategory()"
        [currentProductId]="selectorCurrentId()"
        [currentProductTitle]="selectorCurrentTitle()"
        [targetSide]="selectorTargetSide()"
        (productSelected)="onProductSelected($event)"
        (closed)="selectorOpen.set(false)">
      </bs-compare-selector>
    </section>
  `,
  styles: [`
    .compare-page {
      padding-top: 24px;
      padding-bottom: 48px;
    }
    .compare-heading {
      font-size: 20px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--space-gutter);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparePage {
  readonly compare = inject(CompareStore);
  private readonly router = inject(Router);

  readonly selectorOpen = signal(false);
  readonly selectorCategory = signal('');
  readonly selectorCurrentId = signal('');
  readonly selectorCurrentTitle = signal('');
  readonly selectorTargetSide = signal<'left' | 'right'>('right');

  openSelectorFor(side: 'left' | 'right'): void {
    const vm = side === 'left' ? this.compare.leftVm() : this.compare.rightVm();
    const otherVm = side === 'left' ? this.compare.rightVm() : this.compare.leftVm();

    if (vm) {
      this.selectorCategory.set(vm.category);
      this.selectorCurrentId.set(vm.id);
      this.selectorCurrentTitle.set(vm.title);
      this.selectorTargetSide.set(side);
      this.selectorOpen.set(true);
    } else if (otherVm) {
      // If we're changing the side that isn't loaded, use the other's category
      this.selectorCategory.set(otherVm.category);
      this.selectorCurrentId.set(side === 'left' ? (this.compare.rightId() ?? '') : (this.compare.leftId() ?? ''));
      this.selectorCurrentTitle.set(otherVm.title);
      this.selectorTargetSide.set(side);
      this.selectorOpen.set(true);
    }
  }

  onProductSelected(event: { side: 'left' | 'right'; product: { id: string } }): void {
    const leftId = this.compare.leftId();
    const rightId = this.compare.rightId();

    let newLeft = leftId;
    let newRight = rightId;

    if (event.side === 'left') {
      newLeft = event.product.id;
    } else {
      newRight = event.product.id;
    }

    if (newLeft && newRight) {
      this.selectorOpen.set(false);
      this.router.navigate(['/compare'], {
        queryParams: { left: newLeft, right: newRight },
      });
    }
  }
}
