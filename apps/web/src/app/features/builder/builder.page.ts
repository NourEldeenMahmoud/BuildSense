import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BuilderWorkspaceComponent } from './ui/builder-workspace.component';
import {
  createBuilderPageViewModel,
  type BuilderUiIntent,
} from './builder-view.models';

/**
 * Production Builder page.
 *
 * Truthful empty/unavailable state: shows the workspace structure with empty
 * slots and honest deferred explanations. No fixture products, no compatibility
 * results, no persistence, no localStorage, no API calls.
 *
 * Catalog navigation is allowed. Disabled actions have visible/accessible reasons.
 */
@Component({
  selector: 'app-builder-page',
  standalone: true,
  imports: [BuilderWorkspaceComponent, RouterLink],
  template: `
    <section class="builder-page app-container" role="region" aria-labelledby="builder-heading">
      <header class="builder-header">
        <h1 id="builder-heading">PC Builder</h1>
        <p class="builder-subtitle">
          Assemble your ideal PC configuration. Component selection and
          compatibility checking are not yet available.
        </p>
      </header>

      <app-builder-workspace
        [slots]="vm.slots"
        [summary]="vm.summary"
        (intent)="onIntent($event)" />

      <section class="builder-unavailable" aria-label="Availability notice">
        <div class="unavailable-card card">
          <h2 class="unavailable-heading">Builder functionality is deferred</h2>
          <p class="unavailable-text">
            The PC Builder, component selection, compatibility engine, and purchase
            plan features require backend milestones that are not yet implemented.
          </p>
          <p class="unavailable-text">
            You can still browse the catalog to research components and their specifications.
          </p>
          <nav class="unavailable-nav" aria-label="Catalog navigation">
            <a class="btn btn-primary" routerLink="/">
              Browse Catalog
            </a>
          </nav>
        </div>
      </section>
    </section>
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
    .builder-unavailable {
      margin-top: var(--space-base);
    }
    .unavailable-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .unavailable-heading {
      font-size: 18px;
      font-weight: 600;
    }
    .unavailable-text {
      color: var(--color-on-surface-variant);
      font-size: 14px;
      line-height: 1.6;
    }
    .unavailable-nav {
      margin-top: var(--space-base);
    }
  `,
})
export class BuilderPage {
  protected readonly vm = createBuilderPageViewModel();

  onIntent(_intent: BuilderUiIntent): void {
    // No persistence or API intent handling in production checkpoint 1.
  }
}
