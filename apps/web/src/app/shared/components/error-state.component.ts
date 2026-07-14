import { Component, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button.component';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  inputs: ['title', 'message', 'showRetry'],
  outputs: ['onRetry'],
  template: `
    <div class="error-state" role="alert" aria-live="assertive">
      <div class="error-icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3 class="error-title">{{ title }}</h3>
      <p class="error-message">{{ message }}</p>
      <div class="error-actions" *ngIf="showRetry">
        <app-button variant="secondary" (onClick)="onRetry.emit()">Retry</app-button>
      </div>
    </div>
  `,
  styles: [`
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-margin-desktop) var(--space-gutter);
      text-align: center;
      background-color: var(--color-surface-container-low);
      border: var(--border-width) solid var(--color-error);
      border-radius: var(--radius-none);
    }
    .error-icon {
      color: var(--color-error);
      margin-bottom: var(--space-gutter);
      width: 48px;
      height: 48px;
    }
    .error-title {
      font-size: 24px;
      color: var(--color-on-surface);
      margin-bottom: var(--space-base);
    }
    .error-message {
      color: var(--color-on-surface-variant);
      margin-bottom: var(--space-gutter);
      max-width: 400px;
    }
    .error-actions {
      display: flex;
      gap: var(--space-gutter);
    }
  `]
})
export class ErrorStateComponent {
  title!: string;
  message!: string;
  showRetry = false;
  onRetry = new EventEmitter<void>();
}
