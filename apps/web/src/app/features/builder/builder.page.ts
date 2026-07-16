import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BuilderWorkspaceComponent } from './ui/builder-workspace.component';
import { ComponentSelectionListComponent } from './ui/component-selection/component-selection-list.component';
import { BuildStore } from './data-access/build.store';
import {
  mapCandidatesToSelectionViewModel,
  type ComponentSelectionViewModel,
} from './ui/component-selection/component-selection-view.models';
import type { BuilderSlotKey } from './builder-view.models';

/**
 * Production Builder page.
 *
 * - `/builder/:publicId` loads that build and stores only the successful
 *   publicId as the latest recovery ID.
 * - `/builder` checks the latest publicId; if present, navigates to the
 *   canonical route; if absent or the saved ID returns 404, creates a
 *   new build and navigates to `/builder/:publicId` with replaceUrl.
 *
 * Components never fabricate values; they display exactly what the
 * store supplies from the API.
 */
@Component({
  selector: 'app-builder-page',
  standalone: true,
  imports: [
    BuilderWorkspaceComponent,
    ComponentSelectionListComponent,
    RouterLink,
  ],
  template: `
    <section class="builder-page" role="region" aria-labelledby="builder-heading">
      <header class="builder-header">
        <h1 id="builder-heading" [class.sr-only]="store.loaded()">PC Builder</h1>
        @if (store.loaded()) {
          <p class="builder-subtitle sr-only">
            Assemble your ideal PC configuration. Add components to each slot
            and check compatibility before purchasing.
          </p>
        } @else {
          <p class="builder-subtitle">
            Assemble your ideal PC configuration.
          </p>
        }
      </header>

      <!-- Conflict notice -->
      @if (store.conflictMessage()) {
        <div class="conflict-notice" role="alert" aria-live="polite">
          <span class="conflict-text">{{ store.conflictMessage() }}</span>
          <button
            class="conflict-dismiss"
            type="button"
            aria-label="Dismiss"
            (click)="store.clearConflictNotice()">
            ✕
          </button>
        </div>
      }

      <!-- Loading state -->
      @if (store.loading() || store.creating()) {
        <div class="builder-loading" role="status" aria-label="Loading build">
          <div class="loading-spinner" aria-hidden="true"></div>
          <span class="loading-text tech-font">
            {{ store.creating() ? 'Creating new build…' : 'Loading build…' }}
          </span>
        </div>
      }

      <!-- Not found state -->
      @if (store.notFound()) {
        <div class="builder-error card" role="alert">
          <h2 class="error-heading">Build Not Found</h2>
          <p class="error-text">
            {{ store.errorMessage() || 'The requested build could not be found.' }}
          </p>
          <nav class="error-nav" aria-label="Recovery navigation">
            <a class="btn btn-primary" routerLink="/builder">
              Start New Build
            </a>
            <a class="btn btn-secondary" routerLink="/">
              Browse Catalog
            </a>
          </nav>
        </div>
      }

      <!-- API error state -->
      @if (store.apiError()) {
        <div class="builder-error card" role="alert">
          <h2 class="error-heading">Error Loading Build</h2>
          <p class="error-text">
            {{ store.errorMessage() || 'An unexpected error occurred.' }}
          </p>
          <div class="error-actions">
            <button class="btn btn-primary" (click)="store.retry()">Retry</button>
            <a class="btn btn-secondary" routerLink="/">Browse Catalog</a>
          </div>
        </div>
      }

      <!-- Loaded state — workspace + optional selection drawer -->
      @if (store.loaded() && store.slots() && store.summary()) {
        <div class="builder-layout">
          <app-builder-workspace
            [slots]="store.slots()!"
            [summary]="store.summary()!"
            [publicId]="store.publicId()"
            (slotClick)="onSlotClick($event)"
            (clearClick)="onClearClick($event)" />

          @if (store.selectionDrawerOpen() && selectionVm()) {
            <div class="selection-drawer-wrapper">
              <app-component-selection-list
                [selection]="selectionVm()!"
                [loading]="store.candidatesLoading()"
                [errorMessage]="store.candidatesError()"
                (selectCandidate)="onCandidateSelect($event)"
                (close)="store.closeSelectionDrawer()" />
            </div>
          }
        </div>

      }

      <!-- Idle state — transitional (route resolving) -->
      @if (store.status() === 'idle') {
        <div class="builder-idle" role="status">
          <span class="loading-text tech-font">Preparing builder…</span>
        </div>
      }
    </section>
  `,
  styles: `
    .builder-page {
      display: flex;
      flex-direction: column;
      width: 100vw;
      min-height: calc(100vh - 64px);
      margin-top: calc(-1 * var(--space-margin-desktop));
      margin-left: calc(50% - 50vw);
      margin-bottom: calc(-1 * var(--space-margin-desktop));
    }
    .builder-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
      padding: 24px 48px 0;
    }
    .builder-header:has(.sr-only) {
      position: absolute;
      padding: 0;
    }
    .builder-subtitle {
      color: var(--color-on-surface-variant);
      font-size: 14px;
      max-width: 640px;
    }

    /* Loading */
    .builder-loading,
    .builder-idle {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 200px;
    }
    .loading-text {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    .loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--color-surface-container-high);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Error */
    .builder-error {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .error-heading {
      font-size: 18px;
      font-weight: 600;
    }
    .error-text {
      color: var(--color-on-surface-variant);
      font-size: 14px;
      line-height: 1.6;
    }
    .error-nav,
    .error-actions {
      display: flex;
      gap: var(--space-base);
      margin-top: var(--space-base);
    }

    /* Conflict notice */
    .conflict-notice {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-base) var(--space-gutter);
      background-color: var(--color-error-container, #fef7e6);
      border: var(--border-width) solid var(--color-error, #b3261e);
      border-radius: var(--radius-none);
      gap: var(--space-base);
      margin: 16px 48px;
    }
    .conflict-text {
      font-size: 13px;
      color: var(--color-on-error-container, #410e0b);
      line-height: 1.5;
    }
    .conflict-dismiss {
      background: transparent;
      border: none;
      color: var(--color-on-error-container, #410e0b);
      font-size: 16px;
      cursor: pointer;
      padding: 2px 6px;
      line-height: 1;
      flex-shrink: 0;
    }

    /* Layout with optional drawer */
    .builder-layout {
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 64px);
    }
    .selection-drawer-wrapper {
      position: fixed;
      z-index: 120;
      top: 64px;
      left: 0;
      bottom: 0;
      width: clamp(280px, 20vw, 360px);
      overflow-y: auto;
      background: var(--color-surface-container);
      box-shadow: 20px 0 40px rgba(0, 0, 0, 0.55);
    }

    @media (min-width: 769px) {
      .builder-layout { display: block; }
    }
    @media (max-width: 768px) {
      .builder-page {
        min-height: calc(100vh - 52px);
        margin-top: calc(-1 * var(--space-margin-mobile));
        margin-left: calc(50% - 50vw);
        margin-bottom: calc(-1 * var(--space-margin-mobile));
      }
      .selection-drawer-wrapper {
        top: 52px;
        width: 100vw;
      }
    }
  `,
})
export class BuilderPage {
  readonly store = inject(BuildStore);

  /** Derived view model for the selection drawer. */
  readonly selectionVm = computed<ComponentSelectionViewModel | null>(() => {
    const slot = this.store.selectedSlot();
    const groups = this.store.candidateGroups();
    if (!slot) {
      return null;
    }
    return mapCandidatesToSelectionViewModel(slot, groups);
  });

  /** Active slot key — used to route candidate selections. */
  private activeSlot: BuilderSlotKey | null = null;

  onSlotClick(slotKey: BuilderSlotKey): void {
    this.activeSlot = slotKey;
    this.store.selectSlot(slotKey);
  }

  onClearClick(slotKey: BuilderSlotKey): void {
    this.store.deleteItem(slotKey);
  }

  onCandidateSelect(productId: string): void {
    if (this.activeSlot) {
      this.store.putItem(this.activeSlot, productId, 1);
    }
  }
}
