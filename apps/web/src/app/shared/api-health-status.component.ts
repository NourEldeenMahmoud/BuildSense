import { Component, inject } from '@angular/core';
import { ApiHealthService } from '../core/api-health.service';

@Component({
  selector: 'app-api-health-status',
  standalone: true,
  template: `@if (health.state() === 'loading') {
      Checking API...
    } @else if (health.state() === 'success') {
      API and database connected
    } @else {
      API unavailable
    }`,
})
export class ApiHealthStatusComponent {
  readonly health = inject(ApiHealthService);
  constructor() {
    this.health.check();
  }
}
