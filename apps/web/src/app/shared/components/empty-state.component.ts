import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty-state">
      <div class="empty-icon" aria-hidden="true">
        <ng-content select="[icon]"></ng-content>
      </div>
      <h3 class="empty-title">{{ title }}</h3>
      <p class="empty-message">{{ message }}</p>
      <div class="empty-actions">
        <ng-content select="[actions]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-margin-desktop) var(--space-gutter);
      text-align: center;
      background-color: var(--color-surface-container-low);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-none);
    }
    .empty-icon {
      color: var(--color-on-surface-variant);
      margin-bottom: var(--space-gutter);
      width: 48px;
      height: 48px;
    }
    .empty-title {
      font-size: 24px;
      color: var(--color-on-surface);
      margin-bottom: var(--space-base);
    }
    .empty-message {
      color: var(--color-on-surface-variant);
      margin-bottom: var(--space-gutter);
      max-width: 400px;
    }
    .empty-actions {
      display: flex;
      gap: var(--space-gutter);
    }
  `]
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) message!: string;
}
