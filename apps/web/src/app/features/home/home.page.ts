import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

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
      text-align: center;
      padding: 2rem;
    }
    h1 {
      color: #1a1a2e;
      margin-bottom: 1rem;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin-top: 2rem;
    }
    .feature-card {
      background: #f8f9fa;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .feature-card h3 {
      color: #1a1a2e;
      margin-bottom: 1rem;
    }
    .feature-card a {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      background: #1a1a2e;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      transition: background 0.2s;
    }
    .feature-card a:hover {
      background: #16213e;
    }
  `,
})
export class HomePage {}
