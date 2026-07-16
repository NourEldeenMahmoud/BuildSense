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
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    ApiHealthStatusComponent,
    OverlayComponent,
    IconButtonComponent,
    AriaLiveComponent,
  ],
  template: `
    <header class="app-header">
      <nav class="app-container app-nav" aria-label="Primary Navigation">
        <a routerLink="/" class="nav-brand" aria-label="BuildSense home">
          <span class="material-symbols-outlined nav-brand-icon" aria-hidden="true">dns</span>
          <span class="nav-brand-text">BuildSense</span>
        </a>

        <!-- Desktop Nav -->
        <div class="nav-links desktop-only">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
            >Home</a
          >
          <a routerLink="/" fragment="catalog-results">Components</a>
          <a routerLink="/builder" routerLinkActive="active">PC Builder</a>
        </div>

        <div class="header-actions">
          <a class="build-status-btn desktop-only" routerLink="/builder">
            <span class="material-symbols-outlined" aria-hidden="true">analytics</span>
            Build status
          </a>
          <a class="start-build-btn desktop-only" routerLink="/builder">
            Start building
            <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </a>

          <!-- Mobile Menu Trigger -->
          <div class="mobile-only">
            <app-icon-button
              #mobileMenuTrigger
              ariaLabel="Open mobile navigation"
              (onClick)="isMobileNavOpen = true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
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
      title="Menu"
    >
      <nav class="mobile-nav-links" aria-label="Mobile Navigation">
        <a
          routerLink="/"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          (click)="isMobileNavOpen = false"
          >Catalog</a
        >
        <a routerLink="/compare" routerLinkActive="active" (click)="isMobileNavOpen = false"
          >Compare</a
        >
        <a routerLink="/builder" routerLinkActive="active" (click)="isMobileNavOpen = false"
          >Builder</a
        >
        <a routerLink="/purchase-plan" routerLinkActive="active" (click)="isMobileNavOpen = false"
          >Purchase plan</a
        >
        <a routerLink="/admin" routerLinkActive="active" (click)="isMobileNavOpen = false">Admin</a>
        <a class="mobile-build-cta" routerLink="/builder" (click)="isMobileNavOpen = false"
          >Start building</a
        >
      </nav>
      <div footer>
        <app-api-health-status />
      </div>
    </app-overlay>

    <app-aria-live [message]="routeAnnouncement" politeness="polite"></app-aria-live>
  `,
  styles: [
    `
      .app-header {
        background-color: #121412;
        border-bottom: var(--border-width) solid rgba(68, 73, 51, 0.3);
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .app-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 64px;
        gap: 20px;
      }
      .nav-brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
      }
      .nav-brand-icon {
        color: var(--color-primary);
        font-variation-settings: 'FILL' 1;
      }
      .nav-brand-text {
        font-family: var(--font-sans);
        font-size: 24px;
        font-weight: 700;
        color: var(--color-on-background);
        letter-spacing: -0.02em;
      }
      .nav-links {
        display: flex;
        align-items: center;
        gap: 32px;
      }
      .nav-links a {
        color: var(--color-on-surface-variant);
        text-decoration: none;
        font-family: var(--font-sans);
        font-size: 16px;
        transition: color 0.2s;
        padding-bottom: 4px;
        border-bottom: 2px solid transparent;
      }
      .nav-links a:hover {
        color: var(--color-primary);
      }
      .nav-links a.active {
        color: var(--color-primary);
        font-weight: 700;
        border-bottom-color: var(--color-primary);
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .build-status-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        padding: 8px 18px;
        border: 1px solid var(--color-outline);
        color: var(--color-on-surface);
        font: 700 11px var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .build-status-btn:hover,
      .build-status-btn:focus-visible {
        border-color: var(--color-primary);
        color: var(--color-primary);
        outline: none;
      }
      .build-status-btn .material-symbols-outlined {
        font-size: 17px;
      }
      .start-build-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        font-family: var(--font-mono);
        font-size: 12px;
        font-weight: 700;
        min-height: 36px;
        padding: 8px 20px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        text-decoration: none;
        transition: background-color 0.2s;
      }
      .start-build-btn:hover {
        background-color: var(--color-primary-container);
      }
      .start-build-btn .material-symbols-outlined {
        font-size: 16px;
      }
      .desktop-only {
        display: flex;
      }
      .mobile-only {
        display: none;
      }
      @media (max-width: 768px) {
        .app-nav {
          display: flex;
          min-height: 52px;
        }
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
      .mobile-nav-links .mobile-build-cta {
        margin-top: 8px;
        padding: 12px;
        border: 1px solid var(--color-primary);
        background: var(--color-primary);
        color: var(--color-on-primary);
        text-align: center;
      }
    `,
  ],
})
export class HeaderComponent {
  private router = inject(Router);

  isMobileNavOpen = false;
  routeAnnouncement = '';

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
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
