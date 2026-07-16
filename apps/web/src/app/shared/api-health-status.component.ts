import { Component, inject } from '@angular/core';
import { ApiHealthService } from '../core/api-health.service';

@Component({
  selector: 'app-api-health-status',
  standalone: true,
  template: `
    <span
      class="health-status tech-font"
      [class.health-success]="health.state() === 'success'"
      [class.health-error]="health.state() === 'error'"
    >
      @if (health.state() === 'loading') {
        Checking system
      } @else if (health.state() === 'success') {
        Build status: ready
      } @else {
        System unavailable
      }
    </span>
  `,
  styles: `
    .health-status {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: var(--color-on-surface-variant);
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .health-status::before {
      width: 6px;
      height: 6px;
      background: var(--color-outline);
      content: '';
    }
    .health-success::before {
      background: var(--color-primary);
    }
    .health-error {
      color: var(--color-error);
    }
    .health-error::before {
      background: var(--color-error);
    }
  `,
})
export class ApiHealthStatusComponent {
  readonly health = inject(ApiHealthService);
  constructor() {
    this.health.check();
  }
}
