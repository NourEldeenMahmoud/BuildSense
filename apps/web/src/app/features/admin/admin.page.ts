import { Component } from '@angular/core';

@Component({
  selector: 'app-admin',
  standalone: true,
  template: `
    <div class="admin-page">
      <h1>Admin Dashboard</h1>
      <p>Data quality and management tools</p>
      <div class="placeholder">
        <p>Admin features coming in M7</p>
      </div>
    </div>
  `,
  styles: `
    .admin-page {
      padding: 1rem;
    }
    h1 {
      color: var(--color-on-surface);
      margin-bottom: 0.5rem;
    }
    .placeholder {
      margin-top: 2rem;
      padding: 2rem;
      background: var(--color-surface-container);
      border: var(--border-width) solid var(--color-border);
      text-align: center;
      color: var(--color-on-surface-variant);
    }
  `,
})
export class AdminPage {}
