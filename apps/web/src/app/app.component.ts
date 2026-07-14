import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './core/shell/header.component';
import { FooterComponent } from './core/shell/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    <div class="app-layout">
      <app-header></app-header>
      <main class="app-container app-main" aria-label="Main content">
        <router-outlet />
      </main>
      <app-footer></app-footer>
    </div>
  `,
  styles: `
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-color: var(--color-background);
    }
    .app-main {
      flex: 1;
      padding-top: var(--space-margin-desktop);
      padding-bottom: var(--space-margin-desktop);
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
export class AppComponent {}

