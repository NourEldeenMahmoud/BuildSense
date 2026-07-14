import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-technical-label',
  standalone: true,
  template: `
    <span class="tech-label tech-font" [attr.aria-label]="ariaLabel">
      <span *ngIf="label" class="label-title">{{ label }}: </span>
      <span class="label-value"><ng-content></ng-content></span>
    </span>
  `,
  styles: [`
    .tech-label {
      display: inline-flex;
      font-size: 13px;
      line-height: 16px;
      letter-spacing: 0.05em;
    }
    .label-title {
      color: var(--color-on-surface-variant);
      margin-right: 4px;
    }
    .label-value {
      color: var(--color-on-surface);
      font-weight: 700;
    }
  `]
})
export class TechnicalLabelComponent {
  @Input() label?: string;
  @Input() ariaLabel?: string;
}
