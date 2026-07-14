import { Component, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-button',
  standalone: true,
  inputs: ['variant', 'disabled', 'ariaLabel', 'type'],
  outputs: ['onClick'],
  template: `
    <button 
      class="btn" 
      [class.btn-primary]="variant === 'primary'"
      [class.btn-secondary]="variant === 'secondary'"
      [disabled]="disabled"
      (click)="onClick.emit($event)"
      [attr.aria-label]="ariaLabel ?? null"
      [attr.aria-disabled]="disabled"
      [attr.type]="type">
      <ng-content></ng-content>
    </button>
  `
})
export class ButtonComponent {
  variant: 'primary' | 'secondary' = 'primary';
  disabled = false;
  ariaLabel?: string;
  type: 'button' | 'submit' | 'reset' = 'button';
  onClick = new EventEmitter<Event>();
}
