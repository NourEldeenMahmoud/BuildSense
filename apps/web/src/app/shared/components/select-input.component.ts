import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  label: string;
  value: string | number;
}

@Component({
  selector: 'app-select-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectInputComponent),
      multi: true
    }
  ],
  template: `
    <div class="input-container">
      <label *ngIf="label" [for]="id" class="input-label tech-font">{{ label }}</label>
      <div class="select-wrapper">
        <select 
          [id]="id"
          [disabled]="disabled"
          [attr.aria-label]="ariaLabel"
          [attr.aria-required]="required"
          [(ngModel)]="value"
          (ngModelChange)="onChange($event)"
          (blur)="onTouched()"
          class="input-field select-field">
          <option *ngIf="placeholder" [value]="''" disabled selected>{{ placeholder }}</option>
          <option *ngFor="let option of options" [value]="option.value">{{ option.label }}</option>
        </select>
        <span class="select-icon" aria-hidden="true">▼</span>
      </div>
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
    .select-wrapper {
      position: relative;
    }
    .select-field {
      width: 100%;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      padding-right: 32px;
      cursor: pointer;
    }
    .select-field:disabled {
      cursor: not-allowed;
      opacity: 0.25;
    }
    .select-field:focus-visible {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px var(--color-primary);
    }
    .select-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      font-size: 10px;
      color: var(--color-on-surface-variant);
    }
  `]
})
export class SelectInputComponent implements ControlValueAccessor {
  @Input() id: string = 'select-' + Math.random().toString(36).substr(2, 9);
  @Input() label?: string;
  @Input() ariaLabel?: string;
  @Input() placeholder = '';
  @Input() options: SelectOption[] = [];
  @Input() disabled = false;
  @Input() required = false;

  value: unknown = '';

  onChange = (_value: unknown): void => {};
  onTouched = (): void => {};

  writeValue(value: unknown): void {
    this.value = value;
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
