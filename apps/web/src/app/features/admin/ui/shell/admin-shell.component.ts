import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AdminAuthService } from '../../core/services/admin-auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <!-- Mobile top bar -->
    <header class="admin-mobile-header" role="banner">
      <button
        class="admin-mobile-menu-btn"
        aria-label="Open navigation"
        [attr.aria-expanded]="drawerOpen()"
        aria-controls="admin-mobile-drawer"
        (click)="drawerOpen.set(true)"
      >
        <span class="material-symbols-outlined">menu</span>
      </button>
      <span class="admin-mobile-brand">BuildSense</span>
      <span class="admin-mobile-sub">Admin</span>
    </header>

    <!-- Mobile drawer backdrop -->
    <div
      class="admin-drawer-backdrop"
      [class.visible]="drawerOpen()"
      (click)="drawerOpen.set(false)"
      aria-hidden="true"
    ></div>

    <!-- Desktop sidebar -->
    <aside class="admin-sidebar" role="complementary">
      <div class="admin-sidebar-header">
        <h1 class="admin-sidebar-title">BuildSense</h1>
        <p class="admin-sidebar-subtitle">Admin Control</p>
      </div>
      <nav class="admin-sidebar-nav" aria-label="Admin navigation">
        <ul class="admin-sidebar-list">
          @for (item of navItems; track item.route) {
            <li>
              <a
                class="admin-sidebar-link"
                [routerLink]="item.route"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                (click)="drawerOpen.set(false)"
              >
                <span class="material-symbols-outlined admin-sidebar-icon">{{ item.icon }}</span>
                {{ item.label }}
              </a>
            </li>
          }
        </ul>
      </nav>
      <div class="admin-sidebar-footer">
        <a class="admin-sidebar-link admin-sidebar-link--footer" routerLink="/" (click)="drawerOpen.set(false)">
          <span class="material-symbols-outlined admin-sidebar-icon">auto_stories</span>
          Back to Catalog
        </a>
        <button class="admin-sidebar-logout" (click)="onLogout()">
          <span class="material-symbols-outlined admin-sidebar-icon">logout</span>
          Logout
        </button>
      </div>
    </aside>

    <!-- Mobile drawer (same content, slides in) -->
    <aside
      id="admin-mobile-drawer"
      class="admin-sidebar admin-sidebar--mobile"
      [class.open]="drawerOpen()"
      role="complementary"
      [attr.aria-hidden]="!drawerOpen()"
    >
      <div class="admin-sidebar-header">
        <h1 class="admin-sidebar-title">BuildSense</h1>
        <p class="admin-sidebar-subtitle">Admin Control</p>
      </div>
      <nav class="admin-sidebar-nav" aria-label="Admin navigation">
        <ul class="admin-sidebar-list">
          @for (item of navItems; track item.route) {
            <li>
              <a
                class="admin-sidebar-link"
                [routerLink]="item.route"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                (click)="drawerOpen.set(false)"
              >
                <span class="material-symbols-outlined admin-sidebar-icon">{{ item.icon }}</span>
                {{ item.label }}
              </a>
            </li>
          }
        </ul>
      </nav>
      <div class="admin-sidebar-footer">
        <a class="admin-sidebar-link admin-sidebar-link--footer" routerLink="/" (click)="drawerOpen.set(false)">
          <span class="material-symbols-outlined admin-sidebar-icon">auto_stories</span>
          Back to Catalog
        </a>
        <button class="admin-sidebar-logout" (click)="onLogout()">
          <span class="material-symbols-outlined admin-sidebar-icon">logout</span>
          Logout
        </button>
      </div>
    </aside>

    <!-- Main content area -->
    <main class="admin-main" role="main">
      <!-- Top bar -->
      <header class="admin-topbar">
        <div class="admin-topbar-left">
          <h2 class="admin-topbar-title">{{ pageTitle() }}</h2>
          <p class="admin-topbar-desc">{{ pageDescription() }}</p>
        </div>
      </header>

      <!-- Page content -->
      <div class="admin-content">
        <router-outlet />
      </div>
    </main>
  `,
  styles: `
    :host {
      display: flex;
      min-height: 100vh;
      background: #131313;
    }

    /* ── Mobile header ────────────────────────────────────────────────── */
    .admin-mobile-header {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 110;
      height: 56px;
      background: #131313;
      border-bottom: 1px solid #353534;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
    }
    .admin-mobile-menu-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: none;
      border: none;
      color: #e5e2e1;
      cursor: pointer;
    }
    .admin-mobile-menu-btn:hover {
      color: #caf300;
    }
    .admin-mobile-brand {
      font-family: var(--font-primary);
      font-size: 18px;
      font-weight: 700;
      color: #caf300;
    }
    .admin-mobile-sub {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c5c9ac;
    }

    @media (max-width: 768px) {
      .admin-mobile-header {
        display: flex;
      }
    }

    /* ── Drawer backdrop ──────────────────────────────────────────────── */
    .admin-drawer-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 120;
      background: rgba(0, 0, 0, 0.6);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }
    .admin-drawer-backdrop.visible {
      opacity: 1;
      pointer-events: auto;
    }

    /* ── Sidebar ──────────────────────────────────────────────────────── */
    .admin-sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: 256px;
      z-index: 130;
      background: #131313;
      border-right: 1px solid #353534;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .admin-sidebar-header {
      padding: 24px;
      border-bottom: 1px solid #353534;
    }
    .admin-sidebar-title {
      font-family: var(--font-primary);
      font-size: 24px;
      font-weight: 700;
      color: #caf300;
      letter-spacing: -0.02em;
      line-height: 32px;
    }
    .admin-sidebar-subtitle {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c5c9ac;
      margin-top: 4px;
    }
    .admin-sidebar-nav {
      flex: 1;
      padding: 16px 0;
    }
    .admin-sidebar-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .admin-sidebar-link {
      display: flex;
      align-items: center;
      padding: 12px 24px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c5c9ac;
      text-decoration: none;
      border-left: 2px solid transparent;
      transition: color 0.15s, background 0.15s, border-color 0.15s;
      cursor: pointer;
    }
    .admin-sidebar-link:hover {
      color: #caf300;
      background: #201f1f;
    }
    .admin-sidebar-link.active {
      color: #caf300;
      background: #2a2a29;
      border-left-color: #caf300;
    }
    .admin-sidebar-icon {
      font-size: 20px;
      margin-right: 12px;
    }
    .admin-sidebar-footer {
      padding: 16px 0;
      border-top: 1px solid #353534;
    }
    .admin-sidebar-link--footer {
      border-left-color: transparent;
    }
    .admin-sidebar-logout {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 12px 24px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c5c9ac;
      background: none;
      border: none;
      border-left: 2px solid transparent;
      cursor: pointer;
      transition: color 0.15s, background 0.15s;
      text-align: left;
    }
    .admin-sidebar-logout:hover {
      color: #ff4b4b;
      background: #201f1f;
    }

    /* ── Mobile sidebar ───────────────────────────────────────────────── */
    .admin-sidebar--mobile {
      display: none;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }
    .admin-sidebar--mobile.open {
      transform: translateX(0);
    }

    @media (max-width: 768px) {
      .admin-sidebar {
        display: none;
      }
      .admin-sidebar--mobile {
        display: flex;
      }
    }

    /* ── Main content ─────────────────────────────────────────────────── */
    .admin-main {
      flex: 1;
      margin-left: 256px;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      min-width: 0;
      max-width: 100%;
    }
    @media (max-width: 768px) {
      .admin-main {
        margin-left: 0;
        padding-top: 56px;
      }
    }

    /* ── Top bar ──────────────────────────────────────────────────────── */
    .admin-topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 16px 24px;
      border-bottom: 1px solid #353534;
      background: #131313;
      position: sticky;
      top: 0;
      z-index: 40;
      gap: 16px;
    }
    @media (max-width: 768px) {
      .admin-topbar {
        display: none;
      }
    }
    .admin-topbar-title {
      font-family: var(--font-mono);
      font-size: 20px;
      font-weight: 600;
      color: #e5e2e1;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      line-height: 28px;
    }
    .admin-topbar-desc {
      font-family: var(--font-mono);
      font-size: 12px;
      color: #c5c9ac;
      margin-top: 4px;
      letter-spacing: 0.02em;
      line-height: 16px;
    }

    /* ── Page content ─────────────────────────────────────────────────── */
    .admin-content {
      flex: 1;
      padding: 24px;
      min-width: 0;
      width: 100%;
      max-width: 1920px;
      margin: 0 auto;
    }
    @media (max-width: 768px) {
      .admin-content {
        padding: 16px;
      }
    }
  `,
})
export class AdminShellComponent {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly drawerOpen = signal(false);
  readonly pageTitle = signal('OVERVIEW');
  readonly pageDescription = signal(
    'Real-time monitoring of ingestion pipelines and catalog integrity.',
  );

  readonly navItems: NavItem[] = [
    { label: 'Overview', icon: 'dashboard', route: '/admin', exact: true },
    { label: 'Scrape Runs', icon: 'memory', route: '/admin/scrape-runs' },
    { label: 'Match Reviews', icon: 'rule', route: '/admin/match-reviews' },
    { label: 'Data Quality', icon: 'query_stats', route: '/admin/data-quality' },
    { label: 'Eligibility Overrides', icon: 'check_circle', route: '/admin/eligibility' },
    { label: 'Worker Jobs', icon: 'workspaces', route: '/admin/jobs' },
    { label: 'Compatibility Quality', icon: 'analytics', route: '/admin/compatibility-quality' },
  ];

  private readonly routeTitles: Record<string, { title: string; desc: string }> = {
    '/admin': {
      title: 'OVERVIEW',
      desc: 'Real-time monitoring of ingestion pipelines and catalog integrity.',
    },
    '/admin/scrape-runs': {
      title: 'SCRAPE RUNS',
      desc: 'Historical and active ingestion pipeline executions.',
    },
    '/admin/match-reviews': {
      title: 'MATCH REVIEWS',
      desc: 'Review flagged product matches — link to catalog, create product, or ignore.',
    },
    '/admin/data-quality': {
      title: 'DATA QUALITY',
      desc: 'Open data quality issues detected across the product catalog.',
    },
    '/admin/eligibility': {
      title: 'ELIGIBILITY OVERRIDES',
      desc: 'View and override product eligibility for the PC builder.',
    },
    '/admin/jobs': {
      title: 'WORKER JOBS',
      desc: 'Durable reprocessing and backfill jobs. Processing is worker-owned.',
    },
    '/admin/compatibility-quality': {
      title: 'COMPATIBILITY QUALITY',
      desc: 'Fact extraction coverage and precision per component category.',
    },
  };

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.updatePageMeta(e.urlAfterRedirects);
      });
    // Set initial meta
    this.updatePageMeta(this.router.url);
  }

  private updatePageMeta(url: string): void {
    // Match base route first, then specific routes
    if (url === '/admin' || url === '/admin/') {
      const meta = this.routeTitles['/admin']!;
      this.pageTitle.set(meta.title);
      this.pageDescription.set(meta.desc);
    } else if (url.startsWith('/admin/scrape-runs/')) {
      this.pageTitle.set('SCRAPE RUN DETAIL');
      this.pageDescription.set('Detailed execution breakdown and failure analysis.');
    } else if (url.startsWith('/admin/match-reviews/')) {
      this.pageTitle.set('MATCH REVIEW DETAIL');
      this.pageDescription.set('Review flagged product — link, create, or ignore.');
    } else if (url.startsWith('/admin/data-quality/')) {
      this.pageTitle.set('ISSUE DETAIL');
      this.pageDescription.set('Diagnostic view of a data quality issue.');
    } else if (url.startsWith('/admin/jobs/')) {
      this.pageTitle.set('JOB DETAIL');
      this.pageDescription.set('Durable job status and execution history.');
    } else {
      for (const [path, meta] of Object.entries(this.routeTitles)) {
        if (url.startsWith(path) && path !== '/admin') {
          this.pageTitle.set(meta.title);
          this.pageDescription.set(meta.desc);
          return;
        }
      }
    }
  }

  async onLogout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
