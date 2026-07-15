import { Component } from '@angular/core';
import { BuilderSlotComponent } from '../app/features/builder/ui/builder-slot.component';
import { BuilderSummaryPanelComponent } from '../app/features/builder/ui/builder-summary-panel.component';
import type { BuilderUiIntent } from '../app/features/builder/builder-view.models';
import { FIXTURE_BUILDER_PAGE_VM } from './fixtures/builder-fixtures';

/**
 * Visual-only wrapper: mobile Builder composition at 390x884.
 *
 * Composes production presentational components with fixture data in a
 * mobile-first list-first layout (Stitch mobile platform reference).
 * This component is ONLY loaded by the visual-test configuration and
 * must never be imported by production routes or production entry points.
 */
@Component({
  selector: 'app-visual-mobile-builder',
  standalone: true,
  imports: [BuilderSlotComponent, BuilderSummaryPanelComponent],
  template: `
    <main class="builder-page" role="main" aria-labelledby="builder-heading">
      <header class="builder-header">
        <h1 id="builder-heading">PC Builder</h1>
        <p class="builder-subtitle">
          Assemble your ideal PC configuration.
        </p>
      </header>

      <section class="builder-slots" role="list" aria-label="Component slots">
        @for (slot of vm.slots; track slot.key) {
          <div role="listitem">
            <app-builder-slot [slot]="slot" />
          </div>
        }
      </section>

      <app-builder-summary-panel
        [summary]="vm.summary"
        (intent)="onIntent($event)" />
    </main>
  `,
  styles: `
    .builder-page {
      padding-top: var(--space-gutter);
      padding-bottom: var(--space-margin-desktop);
      display: flex;
      flex-direction: column;
      gap: var(--space-gutter);
      padding-left: var(--space-margin-mobile);
      padding-right: var(--space-margin-mobile);
    }
    .builder-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .builder-subtitle {
      color: var(--color-on-surface-variant);
      font-size: 14px;
    }
    .builder-slots {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
  `,
})
export class VisualMobileBuilderPage {
  protected readonly vm = FIXTURE_BUILDER_PAGE_VM;

  onIntent(_intent: BuilderUiIntent): void {
    // Visual-only wrapper — no intent handling.
  }
}
