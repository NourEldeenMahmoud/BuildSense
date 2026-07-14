import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-image-fallback',
  standalone: true,
  template: `
    <div class="image-wrapper">
      <img 
        *ngIf="!hasError" 
        [src]="src" 
        [alt]="alt" 
        (error)="onError()"
        class="image" 
        loading="lazy" />
      <div *ngIf="hasError" class="fallback">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span class="sr-only">{{ alt }} (Image failed to load)</span>
      </div>
    </div>
  `,
  styles: [`
    .image-wrapper {
      width: 100%;
      height: 100%;
      background-color: var(--color-surface-container-high);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-on-surface-variant);
    }
    .fallback svg {
      width: 32px;
      height: 32px;
      opacity: 0.5;
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
  `]
})
export class ImageFallbackComponent {
  @Input({ required: true }) src!: string;
  @Input({ required: true }) alt!: string;

  hasError = false;

  onError(): void {
    this.hasError = true;
  }
}
