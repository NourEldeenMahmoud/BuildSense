import { Component, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-icon-button',
  standalone: true,
  inputs: ['ariaLabel', 'disabled', 'type'],
  outputs: ['onClick'],
  template: `
    <button 
      class="icon-btn" 
      [attr.aria-label]="ariaLabel"
      [disabled]="disabled"
      [attr.aria-disabled]="disabled"
      [attr.type]="type"
      (click)="onClick.emit($event)">
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    .icon-btn {
      background: transparent;
      border: none;
      color: var(--color-on-surface-variant);
      cursor: pointer;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s, background-color 0.2s;
      border-radius: var(--radius-none);
    }
    .icon-btn:hover:not(:disabled) {
      color: var(--color-primary);
      background-color: var(--color-surface-container-high);
    }
    .icon-btn:focus-visible {
      color: var(--color-primary);
      outline: 1px solid var(--color-primary);
      outline-offset: 2px;
    }
    .icon-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class IconButtonComponent {
  ariaLabel!: string;
  disabled = false;
  type: 'button' | 'submit' | 'reset' = 'button';
  onClick = new EventEmitter<Event>();
}
