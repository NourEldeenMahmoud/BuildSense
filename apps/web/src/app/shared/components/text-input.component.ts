import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-text-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true
    }
  ],
  template: `
    <div class="input-container">
      <label *ngIf="label" [for]="id" class="input-label tech-font">{{ label }}</label>
      <input 
        [id]="id"
        [type]="type"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [attr.aria-label]="ariaLabel"
        [attr.aria-required]="required"
        [attr.aria-invalid]="!!error"
        [attr.aria-describedby]="error ? id + '-error' : null"
        [(ngModel)]="value"
        (ngModelChange)="onChange($event)"
        (blur)="onTouched()"
        class="input-field"
        [class.has-error]="!!error"
      />
      <span *ngIf="error" [id]="id + '-error'" class="input-error tech-font" aria-live="polite">
        {{ error }}
      </span>
    </div>
  `,
  styles: [`
    .input-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }
    .input-label {
      font-size: 13px;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .input-field {
      width: 100%;
    }
    .input-field.has-error {
      border-color: var(--color-error);
    }
    .input-field:focus-visible {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px var(--color-primary);
    }
    .input-field:disabled {
      cursor: not-allowed;
      opacity: 0.25;
    }
    .input-error {
      font-size: 12px;
      color: var(--color-error);
    }
  `]
})
export class TextInputComponent implements ControlValueAccessor {
  @Input() id: string = 'input-' + Math.random().toString(36).substr(2, 9);
  @Input() label?: string;
  @Input() ariaLabel?: string;
  @Input() placeholder = '';
  @Input() type = 'text';
  @Input() disabled = false;
  @Input() required = false;
  @Input() error?: string;

  value: string = '';

  onChange = (_value: unknown): void => {};
  onTouched = (): void => {};

  writeValue(value: unknown): void {
    this.value = value as string;
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
