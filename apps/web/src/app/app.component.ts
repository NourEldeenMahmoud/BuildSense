import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ApiHealthStatusComponent } from './shared/api-health-status.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ApiHealthStatusComponent, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-layout">
      <header class="app-header">
        <nav class="app-nav">
          <a routerLink="/" class="nav-brand">BuildSense</a>
          <div class="nav-links">
            <a routerLink="/catalog" routerLinkActive="active">Catalog</a>
            <a routerLink="/builder" routerLinkActive="active">Builder</a>
            <a routerLink="/purchase-plan" routerLinkActive="active">Purchase plan</a>
            <a routerLink="/admin" routerLinkActive="active">Admin</a>
          </div>
          <app-api-health-status />
        </nav>
      </header>
      <main class="app-main">
        <router-outlet />
      </main>
      <footer class="app-footer">
        <p>BuildSense - Egyptian PC Hardware Platform</p>
      </footer>
    </div>
  `,
  styles: `
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .app-header {
      background: #1a1a2e;
      color: white;
      padding: 1rem 2rem;
    }
    .app-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1200px;
      margin: 0 auto;
    }
    .nav-brand {
      font-size: 1.5rem;
      font-weight: bold;
      color: white;
      text-decoration: none;
    }
    .nav-links {
      display: flex;
      gap: 1.5rem;
    }
    .nav-links a {
      color: #ccc;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      transition: background 0.2s;
    }
    .nav-links a:hover,
    .nav-links a.active {
      background: #16213e;
      color: white;
    }
    .app-main {
      flex: 1;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      width: 100%;
    }
    .app-footer {
      background: #f5f5f5;
      padding: 1rem 2rem;
      text-align: center;
      color: #666;
    }
  `,
})
export class AppComponent {}
