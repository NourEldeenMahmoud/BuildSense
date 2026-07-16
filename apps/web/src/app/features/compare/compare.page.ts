import { Component, ChangeDetectionStrategy, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, finalize, Observable, switchMap, take, tap, throwError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CompareStore } from './data-access/compare.store';
import { CompareHeadersComponent } from './ui/compare-headers.component';
import { CompareSpecMatrixComponent } from './ui/compare-spec-matrix.component';
import { CompareSelectorComponent } from './ui/compare-selector.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { BuildService } from '../builder/data-access/build.service';
import { getLatestBuildId, setLatestBuildId } from '../../core/storage';
import type { BuildDto, BuildSlotName } from '@buildsense/contracts';

const CATEGORY_SLOT_MAP: Readonly<Record<string, BuildSlotName>> = {
  cpu: 'cpu',
  motherboard: 'motherboard',
  ram: 'ram',
  gpu: 'gpu',
  storage: 'storage',
  psu: 'psu',
  case: 'case',
};

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
          <header class="compare-hero">
            <h1 class="compare-heading">Comparison Matrix</h1>
            <p class="compare-kicker tech-font">
              <span class="material-symbols-outlined" aria-hidden="true">memory</span>
              Analyzing: real product specifications &amp; current store data
            </p>
          </header>

          <!-- Loading state -->
          @if (compare.loading()) {
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
            <!-- Product headers -->
            <bs-compare-headers
              [leftVm]="compare.leftVm()"
              [rightVm]="compare.rightVm()"
              [loading]="false"
              [addingSide]="addingSide()"
              (onAddToBuild)="addToBuilder($event)"
              (onChangeClick)="openSelectorFor($event)">
            </bs-compare-headers>

            @if (addToBuilderError()) {
              <p class="compare-action-error tech-font" role="alert">{{ addToBuilderError() }}</p>
            }

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
    :host { display: block; margin-top: -24px; }
    .compare-page {
      width: 100%;
      max-width: 1600px;
      padding-top: 16px;
      padding-bottom: 64px;
      background-image:
        linear-gradient(rgba(68, 73, 51, 0.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(68, 73, 51, 0.045) 1px, transparent 1px);
      background-size: 24px 24px;
    }
    .compare-hero {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(68, 73, 51, 0.55);
    }
    .compare-heading {
      margin: 0;
      font-size: clamp(42px, 4.2vw, 64px);
      font-weight: 700;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: -0.035em;
    }
    .compare-kicker {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-on-surface-variant);
      font-size: 13px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .compare-kicker .material-symbols-outlined {
      color: var(--color-primary);
      font-size: 17px;
    }
    .compare-action-error {
      margin: -12px 0 24px;
      padding: 10px 12px;
      border-left: 2px solid var(--color-error);
      background: color-mix(in srgb, var(--color-error) 8%, transparent);
      color: var(--color-error);
      font-size: 13px;
    }
    @media (max-width: 767px) {
      :host { margin-top: 0; }
      .compare-page { padding-top: 16px; padding-bottom: 40px; }
      .compare-hero { margin-bottom: 24px; padding-bottom: 20px; }
      .compare-heading { font-size: 40px; }
      .compare-kicker { align-items: flex-start; font-size: 11px; line-height: 1.5; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparePage {
  readonly compare = inject(CompareStore);
  private readonly router = inject(Router);
  private readonly buildService = inject(BuildService);
  private readonly destroyRef = inject(DestroyRef);

  readonly selectorOpen = signal(false);
  readonly selectorCategory = signal('');
  readonly selectorCurrentId = signal('');
  readonly selectorCurrentTitle = signal('');
  readonly selectorTargetSide = signal<'left' | 'right'>('right');
  readonly addingSide = signal<'left' | 'right' | null>(null);
  readonly addToBuilderError = signal<string | null>(null);

  addToBuilder(side: 'left' | 'right'): void {
    const product = side === 'left' ? this.compare.leftVm() : this.compare.rightVm();
    const slot = product ? CATEGORY_SLOT_MAP[product.category.trim().toLocaleLowerCase()] : null;
    if (!product || !slot || this.addingSide()) return;

    this.addingSide.set(side);
    this.addToBuilderError.set(null);

    this.getOrCreateBuild()
      .pipe(
        take(1),
        tap((build) => setLatestBuildId(build.publicId)),
        switchMap((build) =>
          this.buildService.putItem(build.publicId, slot, {
            productId: product.id,
            quantity: 1,
            expectedVersion: build.version,
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.addingSide.set(null)),
      )
      .subscribe({
        next: (build) => {
          setLatestBuildId(build.publicId);
          void this.router.navigate(['/builder', build.publicId]);
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.addToBuilderError.set(
            error.error?.error ??
            error.error?.message ??
            error.message ??
            'Failed to add this product to the Builder.',
          );
        },
      });
  }

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

  private getOrCreateBuild(): Observable<BuildDto> {
    const savedBuildId = getLatestBuildId();
    if (!savedBuildId) return this.buildService.createBuild();

    return this.buildService.getBuild(savedBuildId).pipe(
      catchError((error: { status?: number }) =>
        error.status === 404
          ? this.buildService.createBuild()
          : throwError(() => error),
      ),
    );
  }
}
