import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-external-link',
  standalone: true,
  template: `
    <a 
      [href]="href" 
      target="_blank" 
      rel="noopener noreferrer" 
      class="external-link tech-font"
      [attr.aria-label]="ariaLabel || 'External link to ' + href">
      <ng-content></ng-content>
      <svg class="external-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    </a>
  `,
  styles: [`
    .external-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--color-on-surface);
      text-decoration: none;
      font-size: 13px;
      transition: color 0.2s;
    }
    .external-link:hover, .external-link:focus-visible {
      color: var(--color-primary);
    }
    .external-icon {
      width: 12px;
      height: 12px;
    }
  `]
})
export class ExternalLinkComponent {
  @Input({ required: true }) href!: string;
  @Input() ariaLabel?: string;
}
