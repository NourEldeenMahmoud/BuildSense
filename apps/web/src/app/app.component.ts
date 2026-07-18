import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { HeaderComponent } from './core/shell/header.component';
import { FooterComponent } from './core/shell/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    @if (!isAdminRoute()) {
      <app-header></app-header>
    }
    <main [class]="isAdminRoute() ? 'app-main--admin' : 'app-container app-main'" [attr.aria-label]="'Main content'">
      <router-outlet />
    </main>
    @if (!isAdminRoute()) {
      <app-footer></app-footer>
    }
  `,
  styles: `
    .app-main {
      flex: 1;
      padding-top: var(--space-margin-desktop);
      padding-bottom: var(--space-margin-desktop);
      width: 100%;
    }
    .app-main--admin {
      flex: 1;
      width: 100%;
    }
    @media (max-width: 768px) {
      .app-main {
        padding-top: var(--space-margin-mobile);
        padding-bottom: var(--space-margin-mobile);
      }
    }
  `,
})
export class AppComponent {
  private readonly router = inject(Router);

  readonly isAdminRoute = signal(false);

  constructor() {
    this.updateAdminState(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateAdminState(e.urlAfterRedirects));
  }

  private updateAdminState(url: string): void {
    this.isAdminRoute.set(url === '/admin' || url.startsWith('/admin/'));
  }
}

