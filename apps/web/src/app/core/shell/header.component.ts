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
            >Catalog</a
          >
          <a routerLink="/compare" routerLinkActive="active">Compare</a>
          <a routerLink="/builder" routerLinkActive="active">Builder</a>
          <a routerLink="/purchase-plan" routerLinkActive="active">Purchase plan</a>
        </div>

        <div class="header-actions">
          <form
            class="header-search wide-desktop-only"
            role="search"
            (submit)="submitSearch($event)"
          >
            <span class="material-symbols-outlined search-icon" aria-hidden="true">search</span>
            <label for="header-catalog-search" class="sr-only">Search component database</label>
            <input
              id="header-catalog-search"
              name="headerSearch"
              type="search"
              placeholder="Search parameters.."
              [value]="headerSearch"
              (input)="headerSearch = inputValue($event)"
            />
          </form>
          <button class="build-status-btn status-desktop-only">
            <span class="status-indicator" style="color: var(--color-primary); margin-right: 4px;">■</span>
            BUILD STATUS: READY
          </button>
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
        background-color: #0b0e0b;
        border-bottom: var(--border-width) solid var(--color-border);
        padding: 0 24px;
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
      .header-search {
        position: relative;
        width: 256px;
      }
      .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--color-on-surface-variant);
        font-size: 18px;
      }
      .header-search input {
        width: 100%;
        background-color: #121412;
        border: 1px solid var(--color-outline-variant);
        color: var(--color-on-background);
        font-family: var(--font-mono);
        font-size: 13px;
        padding: 8px 16px 8px 40px;
        outline: none;
        transition: border-color 0.2s;
      }
      .header-search input:focus {
        border-color: var(--color-primary);
      }
      .build-status-btn {
        background: transparent;
        border: none;
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        cursor: pointer;
        transition: color 0.2s;
      }
      .build-status-btn:hover {
        color: var(--color-primary);
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
        padding: 8px 24px;
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
      @media (max-width: 1120px) {
        .wide-desktop-only,
        .status-desktop-only {
          display: none;
        }
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
        this.headerSearch = this.router.parseUrl(path).queryParams['search'] ?? '';
        let pageName = 'Home';
        if (path.includes('catalog')) pageName = 'Catalog';
        else if (path.includes('builder')) pageName = 'Builder';
        else if (path.includes('purchase-plan')) pageName = 'Purchase Plan';
        else if (path.includes('admin')) pageName = 'Admin';

        this.routeAnnouncement = 'Navigated to ' + pageName + ' page';
      });
  }

  headerSearch = '';

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    const search = this.headerSearch.trim();
    void this.router.navigate(['/'], {
      queryParams: { search: search || null, page: null },
      queryParamsHandling: 'merge',
    });
  }
}
