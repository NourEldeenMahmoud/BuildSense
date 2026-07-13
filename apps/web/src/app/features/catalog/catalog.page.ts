import { Component } from '@angular/core';

@Component({
  selector: 'app-catalog',
  standalone: true,
  template: `
    <div class="catalog-page">
      <h1>Product Catalog</h1>
      <p>Browse PC components from Sigma store</p>
      <div class="placeholder">
        <p>Catalog features coming in M5</p>
      </div>
    </div>
  `,
  styles: `
    .catalog-page {
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
export class CatalogPage {}
