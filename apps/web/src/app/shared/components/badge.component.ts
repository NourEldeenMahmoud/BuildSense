import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge tech-font" [ngClass]="variantClass" [attr.aria-label]="ariaLabel()">
      <ng-content></ng-content>
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 700;
      border-radius: var(--radius-none);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-default {
      background-color: var(--color-surface-container-high);
      color: var(--color-on-surface);
      border: var(--border-width) solid var(--color-border);
    }
    .badge-primary {
      background-color: var(--color-primary);
      color: var(--color-on-primary);
    }
    .badge-warning {
      background-color: #f59e0b; /* muted orange */
      color: var(--color-on-primary);
    }
  `]
})
export class BadgeComponent {
  variant = input<'default' | 'primary' | 'warning'>('default');
  ariaLabel = input<string>();

  get variantClass(): string {
    return 'badge-' + this.variant();
  }
}
