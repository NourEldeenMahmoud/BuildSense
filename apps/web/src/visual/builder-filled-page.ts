import { Component } from '@angular/core';
import { BuilderWorkspaceComponent } from '../app/features/builder/ui/builder-workspace.component';
import type { BuilderUiIntent } from '../app/features/builder/builder-view.models';
import { FIXTURE_BUILDER_PAGE_VM } from './fixtures/builder-fixtures';

/**
 * Visual-only wrapper: filled Builder composition.
 *
 * Composes the production BuilderWorkspaceComponent with fixture data.
 * This component is ONLY loaded by the visual-test configuration and
 * must never be imported by production routes or production entry points.
 */
@Component({
  selector: 'app-visual-builder-filled',
  standalone: true,
  imports: [BuilderWorkspaceComponent],
  template: `
    <main class="builder-page app-container" role="main" aria-labelledby="builder-heading">
      <header class="builder-header">
        <h1 id="builder-heading">PC Builder</h1>
        <p class="builder-subtitle">
          Assemble your ideal PC configuration.
        </p>
      </header>

      <app-builder-workspace
        [slots]="vm.slots"
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
    }
    .builder-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .builder-subtitle {
      color: var(--color-on-surface-variant);
      font-size: 14px;
      max-width: 640px;
    }
  `,
})
export class VisualBuilderFilledPage {
  protected readonly vm = FIXTURE_BUILDER_PAGE_VM;

  onIntent(_intent: BuilderUiIntent): void {
    // Visual-only wrapper — no intent handling.
  }
}
