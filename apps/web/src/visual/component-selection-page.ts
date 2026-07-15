import { Component } from '@angular/core';
import { ComponentSelectionListComponent } from '../app/features/builder/ui/component-selection/component-selection-list.component';
import { FIXTURE_SELECTION_CPU } from './fixtures/component-selection-fixtures';

/**
 * Visual-only wrapper: Component Selection drawer composition.
 *
 * Composes the production ComponentSelectionListComponent with fixture data.
 * This component is ONLY loaded by the visual-test configuration and
 * must never be imported by production routes or production entry points.
 */
@Component({
  selector: 'app-visual-component-selection',
  standalone: true,
  imports: [ComponentSelectionListComponent],
  template: `
    <main class="selection-page app-container" role="main" aria-labelledby="selection-heading">
      <header class="page-header">
        <h1 id="selection-heading">Component Selection</h1>
        <p class="page-subtitle">
          Choose a component for your build configuration.
        </p>
      </header>

      <app-component-selection-list [selection]="selection" />
    </main>
  `,
  styles: `
    .selection-page {
      padding-top: var(--space-gutter);
      padding-bottom: var(--space-margin-desktop);
      display: flex;
      flex-direction: column;
      gap: var(--space-gutter);
    }
    .page-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .page-subtitle {
      color: var(--color-on-surface-variant);
      font-size: 14px;
      max-width: 640px;
    }
  `,
})
export class VisualComponentSelectionPage {
  protected readonly selection = FIXTURE_SELECTION_CPU;
}
