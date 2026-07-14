import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogStore } from '../catalog/data-access/catalog.store';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="home-page">
      <h1>Welcome to BuildSense</h1>
      <p>Egyptian PC hardware catalog and compatibility engine</p>
      
      <div class="features">
        <div class="feature-card">
          <h3>Browse Products</h3>
          <p>Explore PC components from Sigma store</p>
          <a routerLink="/catalog">View Catalog</a>
        </div>
        <div class="feature-card">
          <h3>Build Your PC</h3>
          <p>Use our compatibility engine to build your perfect PC</p>
          <a routerLink="/builder">Start Building</a>
        </div>
      </div>
    </div>
  `,
  styles: `
    .home-page {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      font-family: var(--font-primary);
      color: var(--text-main);
      margin-bottom: 0.5rem;
    }
    p {
      color: var(--text-muted);
      margin-bottom: 2rem;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }
    .feature-card {
      background: var(--surface-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-default);
      padding: 1.5rem;
    }
    .feature-card h3 {
      color: var(--text-main);
      margin-top: 0;
      margin-bottom: 0.5rem;
    }
    .feature-card p {
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }
    .feature-card a {
      display: inline-block;
      background: var(--accent-primary);
      color: var(--surface-main);
      padding: 0.5rem 1rem;
      text-decoration: none;
      transition: background 0.2s;
    }
    .feature-card a:hover {
      background: var(--color-surface-container-high);
    }

    .catalog-test-state {
      margin-top: 3rem;
      padding: 1rem;
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-border);
    }
    .catalog-test-state h2 {
      font-family: var(--font-mono);
      font-size: 1.2rem;
      color: var(--color-secondary);
      margin-bottom: 1rem;
    }
    .controls {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .controls button {
      padding: 0.5rem 1rem;
      background: var(--color-surface-bright);
      color: var(--color-on-surface);
      border: 1px solid var(--color-border);
      cursor: pointer;
    }
    .controls button:hover {
      border-color: var(--color-primary);
    }
    pre {
      background: #000;
      color: #0f0;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.85rem;
    }
    .status {
      padding: 1rem;
      background: var(--color-surface-container);
      margin-bottom: 1rem;
    }
    .status.error {
      color: var(--color-error);
    }
  `,
})
export class HomePage {
  constructor() {
    // Inject store to ensure it's instantiated and processes URL state in the background
    inject(CatalogStore);
  }
}
