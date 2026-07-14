import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `
    <div 
      class="spinner" 
      [style.width]="size" 
      [style.height]="size"
      role="status"
      [attr.aria-label]="ariaLabel">
      <span class="sr-only">{{ ariaLabel }}</span>
    </div>
  `,
  styles: [`
    .spinner {
      border: 2px solid var(--color-surface-container-high);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      display: inline-block;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class SpinnerComponent {
  @Input() size: string = '24px';
  @Input() ariaLabel: string = 'Loading...';
}
