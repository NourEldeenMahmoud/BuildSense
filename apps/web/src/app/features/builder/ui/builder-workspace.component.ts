import { Component, EventEmitter } from '@angular/core';
import { BuilderSlotComponent } from './builder-slot.component';
import { BuilderSummaryPanelComponent } from './builder-summary-panel.component';
import type {
  BuilderSlotViewModel,
  BuilderSlotKey,
  BuilderSummaryViewModel,
  BuilderUiIntent,
} from '../builder-view.models';

/**
 * Presentational workspace composition for the Builder.
 *
 * Desktop: two-column layout with slots on the left and summary on the right.
 * Mobile (<=768px): single-column list-first with summary below.
 *
 * Input-driven: receives immutable view models, emits UI intents only.
 * No fixture data, no persistence, no compatibility, no API calls.
 */
@Component({
  selector: 'app-builder-workspace',
  standalone: true,
  imports: [BuilderSlotComponent, BuilderSummaryPanelComponent],
  inputs: ['slots', 'summary'],
  outputs: ['slotClick', 'clearClick', 'intent'],
  template: `
    <section class="builder-workspace" aria-label="PC Builder workspace">
      <div class="workspace-slots" role="list" aria-label="Component slots">
        @for (slot of slots; track slot.key) {
          <div role="listitem">
            <app-builder-slot
              [slot]="slot"
              (slotClick)="slotClick.emit($event)"
              (clearClick)="clearClick.emit($event)" />
          </div>
        }
      </div>

      <app-builder-summary-panel
        [summary]="summary"
        (intent)="intent.emit($event)" />
    </section>
  `,
  styles: `
    .builder-workspace {
      display: flex;
      flex-direction: column;
      gap: var(--space-gutter);
    }

    .workspace-slots {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }

    @media (min-width: 769px) {
      .builder-workspace {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: var(--space-gutter);
        align-items: start;
      }
    }
  `,
})
export class BuilderWorkspaceComponent {
  slots: readonly BuilderSlotViewModel[] = [];
  summary!: BuilderSummaryViewModel;
  slotClick = new EventEmitter<BuilderSlotKey>();
  clearClick = new EventEmitter<BuilderSlotKey>();
  intent = new EventEmitter<BuilderUiIntent>();
}
