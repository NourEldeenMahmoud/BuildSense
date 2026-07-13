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
      color: #1a1a2e;
      margin-bottom: 0.5rem;
    }
    .placeholder {
      margin-top: 2rem;
      padding: 2rem;
      background: #f8f9fa;
      border-radius: 8px;
      text-align: center;
      color: #666;
    }
  `,
})
export class AdminPage {}
