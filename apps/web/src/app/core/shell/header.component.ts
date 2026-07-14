import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ApiHealthStatusComponent } from '../../shared/api-health-status.component';
import { OverlayComponent } from '../../shared/components/overlay.component';
import { IconButtonComponent } from '../../shared/components/icon-button.component';
import { AriaLiveComponent } from '../../shared/components/aria-live.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ApiHealthStatusComponent, OverlayComponent, IconButtonComponent, AriaLiveComponent],
  template: `
    <header class="app-header">
      <nav class="app-container app-nav" aria-label="Primary Navigation">
        <a routerLink="/" class="nav-brand">BUILDSENSE</a>
        
        <!-- Desktop Nav -->
        <div class="nav-links desktop-only">
          <a routerLink="/catalog" routerLinkActive="active">Catalog</a>
          <a routerLink="/builder" routerLinkActive="active">Builder</a>
          <a routerLink="/purchase-plan" routerLinkActive="active">Purchase plan</a>
          <a routerLink="/admin" routerLinkActive="active">Admin</a>
        </div>
        
        <div class="header-actions">
          <app-api-health-status class="desktop-only" />
          
          <!-- Mobile Menu Trigger -->
          <div class="mobile-only">
            <app-icon-button 
              #mobileMenuTrigger
              ariaLabel="Open mobile navigation" 
              (onClick)="isMobileNavOpen = true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </app-icon-button>
          </div>
        </div>
      </nav>
    </header>

    <!-- Mobile Navigation Overlay -->
    <app-overlay 
      [isOpen]="isMobileNavOpen" 
      (isOpenChange)="isMobileNavOpen = $event"
      ariaLabel="Mobile Navigation"
      title="Menu">
      <nav class="mobile-nav-links" aria-label="Mobile Navigation">
        <a routerLink="/catalog" routerLinkActive="active" (click)="isMobileNavOpen = false">Catalog</a>
        <a routerLink="/builder" routerLinkActive="active" (click)="isMobileNavOpen = false">Builder</a>
        <a routerLink="/purchase-plan" routerLinkActive="active" (click)="isMobileNavOpen = false">Purchase plan</a>
        <a routerLink="/admin" routerLinkActive="active" (click)="isMobileNavOpen = false">Admin</a>
      </nav>
      <div footer>
        <app-api-health-status />
      </div>
    </app-overlay>
    
    <app-aria-live [message]="routeAnnouncement" politeness="polite"></app-aria-live>
  `,
  styles: [`
    .app-header {
      background-color: var(--color-surface);
      border-bottom: var(--border-width) solid var(--color-border);
      padding: var(--space-margin-mobile) 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .app-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .nav-brand {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-primary);
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    .nav-links {
      display: flex;
      gap: var(--space-gutter);
    }
    .nav-links a, .mobile-nav-links a {
      color: var(--color-on-surface-variant);
      text-decoration: none;
      font-family: var(--font-mono);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: color 0.2s;
    }
    .nav-links a:hover, .nav-links a.active,
    .mobile-nav-links a:hover, .mobile-nav-links a.active {
      color: var(--color-primary);
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--space-base);
    }
    .desktop-only {
      display: flex;
    }
    .mobile-only {
      display: none;
    }
    @media (max-width: 768px) {
      .desktop-only {
        display: none !important;
      }
      .mobile-only {
        display: flex;
      }
    }
    .mobile-nav-links {
      display: flex;
      flex-direction: column;
      gap: var(--space-margin-mobile);
      padding-top: var(--space-base);
    }
    .mobile-nav-links a {
      font-size: 16px;
      padding: var(--space-base) 0;
      border-bottom: var(--border-width) solid var(--color-border);
    }
  `]
})
export class HeaderComponent {
  private router = inject(Router);

  isMobileNavOpen = false;
  routeAnnouncement = '';

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.isMobileNavOpen = false;
      
      // Create an accessible announcement for route changes
      const path = event.urlAfterRedirects;
      let pageName = 'Home';
      if (path.includes('catalog')) pageName = 'Catalog';
      else if (path.includes('builder')) pageName = 'Builder';
      else if (path.includes('purchase-plan')) pageName = 'Purchase Plan';
      else if (path.includes('admin')) pageName = 'Admin';
      
      this.routeAnnouncement = 'Navigated to ' + pageName + ' page';
    });
  }
}
