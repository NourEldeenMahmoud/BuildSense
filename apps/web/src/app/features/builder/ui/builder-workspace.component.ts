import { Component, EventEmitter } from '@angular/core';
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
  imports: [BuilderSummaryPanelComponent],
  inputs: ['slots', 'summary', 'publicId'],
  outputs: ['slotClick', 'clearClick', 'intent'],
  template: `
    <section class="builder-workspace" aria-label="PC Builder workspace">
      <div class="visual-workspace">
        <div class="axis axis-vertical" aria-hidden="true"></div>
        <div class="axis axis-horizontal" aria-hidden="true"></div>
        <div class="case-stage">
          <img
            class="case-image"
            src="/assets/images/builder-case-stitch.png"
            alt="Open graphite PC case ready for components" />
          @for (slot of slots; track slot.key) {
            <button
              type="button"
              [class]="'hotspot hotspot-' + slot.key"
              [class.hotspot-filled]="slot.selectedProduct !== null"
              [attr.aria-label]="slot.selectedProduct !== null ? 'Replace ' + slot.displayName : 'Add ' + slot.displayName"
              (click)="slotClick.emit(slot.key)">
              <span class="material-symbols-outlined" aria-hidden="true">
                {{ slot.selectedProduct !== null ? 'check' : 'add' }}
              </span>
              <span class="hotspot-label">
                {{ slot.selectedProduct !== null ? slot.displayName + ' selected' : 'Add ' + slot.displayName }}
              </span>
            </button>
          }
        </div>

        <section class="compatibility-guide" aria-label="Compatibility guidance">
          <span class="guide-icon material-symbols-outlined" aria-hidden="true">info</span>
          <div>
            <h2>{{ guidanceHeading }}</h2>
            <p>{{ guidanceText }}</p>
            @if (missingSlotNames.length > 0) {
              <div class="missing-slots tech-font">
                <span>Missing:</span>
                @for (name of missingSlotNames; track name; let last = $last) {
                  <strong>{{ name }}</strong>@if (!last) {<span aria-hidden="true">•</span>}
                }
              </div>
            } @else {
              <div class="missing-slots tech-font">
                <span>Overall status:</span>
                <strong>{{ summary.compatibilityStatusLabel ?? 'Unknown' }}</strong>
              </div>
            }
          </div>
        </section>
      </div>

      <app-builder-summary-panel
        [summary]="summary"
        [slots]="slots"
        [publicId]="publicId"
        (slotClick)="slotClick.emit($event)"
        (clearClick)="clearClick.emit($event)"
        (intent)="intent.emit($event)" />
    </section>
  `,
  styles: `
    .builder-workspace {
      display: grid;
      grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
      width: 100%;
      max-width: 1600px;
      min-height: calc(100vh - 64px);
      margin-inline: auto;
      background: var(--color-surface);
    }
    app-builder-summary-panel {
      min-width: 0;
    }
    .visual-workspace {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      min-width: 0;
      overflow: hidden;
      padding: 40px 48px;
      background-color: #101210;
      background-image:
        linear-gradient(rgba(197, 201, 172, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(197, 201, 172, 0.035) 1px, transparent 1px);
      background-size: 32px 32px;
    }
    .axis {
      position: absolute;
      background: rgba(68, 73, 51, 0.16);
      pointer-events: none;
    }
    .axis-vertical {
      top: 0;
      bottom: 0;
      left: 50%;
      width: 1px;
    }
    .axis-horizontal {
      top: 50%;
      right: 0;
      left: 0;
      height: 1px;
    }
    .case-stage {
      position: relative;
      display: grid;
      place-items: center;
      width: min(100%, 760px);
      height: 460px;
      min-height: 460px;
      flex: 0 0 460px;
    }
    .case-image {
      width: 100%;
      height: 100%;
      max-height: 460px;
      object-fit: contain;
      opacity: 0.96;
      filter: drop-shadow(0 28px 30px rgba(0, 0, 0, 0.48));
    }
    .hotspot {
      position: absolute;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      height: 44px;
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--color-primary);
      border-radius: 999px;
      background: rgba(13, 15, 13, 0.94);
      color: var(--color-primary);
      cursor: pointer;
      box-shadow: 0 0 16px rgba(199, 243, 0, 0.14);
      transform: translate(-50%, -50%);
      transition:
        padding 0.2s ease,
        background-color 0.2s ease,
        color 0.2s ease,
        box-shadow 0.2s ease;
    }
    .hotspot .material-symbols-outlined {
      flex: 0 0 42px;
      font-size: 22px;
    }
    .hotspot-label {
      max-width: 0;
      opacity: 0;
      white-space: nowrap;
      font: 700 10px var(--font-mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transition:
        max-width 0.2s ease,
        opacity 0.2s ease;
    }
    .hotspot:hover,
    .hotspot:focus-visible {
      z-index: 5;
      padding-right: 16px;
      background: var(--color-primary);
      color: var(--color-on-primary);
      box-shadow: 0 0 22px rgba(199, 243, 0, 0.3);
      outline: none;
    }
    .hotspot:hover .hotspot-label,
    .hotspot:focus-visible .hotspot-label {
      max-width: 150px;
      opacity: 1;
    }
    .hotspot-filled {
      background: var(--color-primary);
      color: var(--color-on-primary);
    }
    .hotspot-cpu { top: 32%; left: 48%; }
    .hotspot-motherboard { top: 48%; left: 55%; }
    .hotspot-ram { top: 32%; left: 65%; }
    .hotspot-gpu { top: 64%; left: 36%; }
    .hotspot-storage { top: 67%; left: 61%; }
    .hotspot-psu { top: 75%; left: 45%; }
    .hotspot-case { top: 47%; left: 73%; }
    .compatibility-guide {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: flex-start;
      gap: 20px;
      width: min(100%, 760px);
      padding: 20px 24px;
      border: 1px solid rgba(68, 73, 51, 0.7);
      background: rgba(31, 32, 30, 0.92);
    }
    .guide-icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      border: 1px solid var(--color-outline-variant);
      border-radius: 999px;
      color: var(--color-on-surface-variant);
      font-size: 20px;
    }
    .compatibility-guide h2 {
      margin-bottom: 4px;
      font-size: 16px;
    }
    .compatibility-guide p {
      color: var(--color-on-surface-variant);
      font-size: 13px;
    }
    .missing-slots {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 10px;
      color: var(--color-outline);
      font-size: 10px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .missing-slots strong {
      color: var(--color-on-surface);
      font-weight: 400;
    }
    @media (min-width: 1920px) {
      .case-stage {
        width: min(100%, 1040px);
        height: 620px;
        min-height: 620px;
        flex-basis: 620px;
      }
      .case-image { max-height: 620px; }
      .compatibility-guide { width: min(100%, 1040px); }
    }
    @media (max-width: 1024px) {
      .builder-workspace {
        grid-template-columns: minmax(0, 1fr) 400px;
      }
      .visual-workspace {
        padding: 32px 24px;
      }
      .case-stage {
        height: 460px;
        min-height: 460px;
        flex-basis: 460px;
      }
    }
    @media (max-width: 768px) {
      .builder-workspace {
        display: flex;
        flex-direction: column;
        min-height: auto;
      }
      .visual-workspace {
        min-height: 680px;
        padding: 24px 16px 32px;
      }
      .case-stage {
        width: min(145%, 700px);
        height: 470px;
        min-height: 470px;
        flex-basis: 470px;
        margin-inline: -22%;
      }
      .hotspot {
        min-width: 40px;
        height: 40px;
      }
      .hotspot .material-symbols-outlined {
        flex-basis: 38px;
        font-size: 20px;
      }
      .hotspot:hover,
      .hotspot:focus-visible {
        padding-right: 12px;
      }
      .compatibility-guide {
        gap: 14px;
        padding: 16px;
      }
      .missing-slots {
        gap: 5px;
      }
    }
  `,
})
export class BuilderWorkspaceComponent {
  slots: readonly BuilderSlotViewModel[] = [];
  summary!: BuilderSummaryViewModel;
  publicId: string | null = null;
  slotClick = new EventEmitter<BuilderSlotKey>();
  clearClick = new EventEmitter<BuilderSlotKey>();
  intent = new EventEmitter<BuilderUiIntent>();

  get missingSlotNames(): readonly string[] {
    return this.slots
      .filter((slot) => slot.selectedProduct === null)
      .map((slot) => slot.displayName);
  }

  get guidanceHeading(): string {
    return this.missingSlotNames.length > 0
      ? 'Complete your build to check compatibility'
      : 'Compatibility evidence is ready';
  }

  get guidanceText(): string {
    return this.missingSlotNames.length > 0
      ? 'Select the required components before relying on the full compatibility result.'
      : 'Review the current compatibility status and evidence in the component summary.';
  }
}
