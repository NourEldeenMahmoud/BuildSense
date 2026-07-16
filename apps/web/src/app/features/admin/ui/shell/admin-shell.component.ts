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
    <header class="admin-mobile-header">
      <button
        class="admin-mobile-menu-btn"
        aria-label="Open navigation"
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
    <aside class="admin-sidebar">
      <div class="admin-sidebar-header">
        <h1 class="admin-sidebar-title">BuildSense</h1>
        <p class="admin-sidebar-subtitle">Admin</p>
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
        <a class="admin-sidebar-link" routerLink="/" (click)="drawerOpen.set(false)">
          <span class="material-symbols-outlined admin-sidebar-icon">auto_stories</span>
          Back to Catalog
        </a>
      </div>
    </aside>

    <!-- Mobile drawer (same content, slides in) -->
    <aside class="admin-sidebar admin-sidebar--mobile" [class.open]="drawerOpen()">
      <div class="admin-sidebar-header">
        <h1 class="admin-sidebar-title">BuildSense</h1>
        <p class="admin-sidebar-subtitle">Admin</p>
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
        <a class="admin-sidebar-link" routerLink="/" (click)="drawerOpen.set(false)">
          <span class="material-symbols-outlined admin-sidebar-icon">auto_stories</span>
          Back to Catalog
        </a>
      </div>
    </aside>

    <!-- Main content area -->
    <main class="admin-main">
      <!-- Top bar -->
      <header class="admin-topbar">
        <div class="admin-topbar-left">
          <h2 class="admin-topbar-title">{{ pageTitle() }}</h2>
          <p class="admin-topbar-desc">{{ pageDescription() }}</p>
        </div>
        <div class="admin-topbar-right">
          <button class="admin-logout-btn" (click)="onLogout()">
            <span class="material-symbols-outlined" style="font-size:16px;">logout</span>
            LOGOUT
          </button>
        </div>
      </header>

      <!-- Page content -->
      <div class="admin-content">
        <router-outlet />
      </div>

      <!-- Footer -->
      <footer class="admin-footer">
        <span class="admin-footer-text">BuildSense Ops</span>
        <span class="admin-footer-text">Read-only Admin</span>
      </footer>
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
      color: #c8c6c5;
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
      font-size: 32px;
      font-weight: 700;
      color: #caf300;
      letter-spacing: -0.02em;
      line-height: 40px;
    }
    .admin-sidebar-subtitle {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
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
      color: #c8c6c5;
      text-decoration: none;
      border-left: 2px solid transparent;
      transition: color 0.15s, background 0.15s, border-color 0.15s;
      cursor: pointer;
    }
    .admin-sidebar-link:hover {
      color: #caf300;
      background: #20201f;
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
      padding: 16px;
      border-top: 1px solid #353534;
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
      padding: 24px;
      border-bottom: 1px solid #353534;
      background: #131313;
      position: sticky;
      top: 0;
      z-index: 40;
      gap: 16px;
      flex-wrap: wrap;
    }
    @media (max-width: 768px) {
      .admin-topbar {
        display: none;
      }
    }
    .admin-topbar-title {
      font-family: var(--font-primary);
      font-size: 20px;
      font-weight: 600;
      color: #e5e2e1;
      text-transform: uppercase;
      letter-spacing: -0.01em;
      line-height: 28px;
    }
    .admin-topbar-desc {
      font-family: var(--font-mono);
      font-size: 12px;
      color: #c8c6c5;
      margin-top: 4px;
      letter-spacing: 0.02em;
    }
    .admin-topbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .admin-logout-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
      background: none;
      border: 1px solid #353534;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .admin-logout-btn:hover {
      color: #ff4b4b;
      border-color: #ff4b4b;
    }

    /* ── Page content ─────────────────────────────────────────────────── */
    .admin-content {
      flex: 1;
      padding: 24px;
      max-width: 1280px;
      width: 100%;
    }
    @media (max-width: 768px) {
      .admin-content {
        padding: 16px;
      }
    }

    /* ── Footer ───────────────────────────────────────────────────────── */
    .admin-footer {
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-top: 1px solid #353534;
      background: #0e0e0e;
    }
    .admin-footer-text {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
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
    { label: 'Compatibility Quality', icon: 'query_stats', route: '/admin/compatibility-quality' },
    { label: 'Reference Data', icon: 'database', route: '/admin/reference-data' },
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
    '/admin/compatibility-quality': {
      title: 'COMPATIBILITY QUALITY',
      desc: 'Fact extraction coverage and precision per component category.',
    },
    '/admin/reference-data': {
      title: 'REFERENCE DATA',
      desc: 'Published compatibility reference datasets and chipset mappings.',
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
    } else {
      for (const [path, meta] of Object.entries(this.routeTitles)) {
        if (url.startsWith(path) && path !== '/admin') {
          this.pageTitle.set(meta.title);
          this.pageDescription.set(meta.desc);
          return;
        }
      }
      // Fallback: keep previous meta
    }
  }

  async onLogout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
