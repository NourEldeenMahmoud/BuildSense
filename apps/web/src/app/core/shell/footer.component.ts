import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="app-footer">
      <div class="app-container footer-content">
        <p class="tech-font">BuildSense - Precision Hardware Discovery</p>
        <p class="tech-font copyright">© 2026 BuildSense</p>
      </div>
    </footer>
  `,
  styles: [`
    .app-footer {
      background-color: var(--color-surface-container-low);
      border-top: var(--border-width) solid var(--color-border);
      padding: var(--space-gutter) 0;
      color: var(--color-on-surface-variant);
      font-size: 12px;
    }
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-base);
    }
    .copyright {
      opacity: 0.7;
    }
  `]
})
export class FooterComponent {}
