import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="skeleton" 
      [style.width]="width" 
      [style.height]="height"
      [style.border-radius]="radius"
      role="status" 
      aria-label="Loading...">
    </div>
  `,
  styles: [`
    .skeleton {
      background-color: var(--color-surface-container-high);
      animation: pulse 1.5s infinite ease-in-out;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }
  `]
})
export class SkeletonComponent {
  @Input() width: string = '100%';
  @Input() height: string = '20px';
  @Input() radius: string = 'var(--radius-none)';
}
