import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-price-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="price-display tech-font" [attr.aria-label]="ariaLabel || 'Price: ' + amount + ' ' + currency">
      <span class="price-amount">{{ amount | number:'1.0-0' }}</span>
      <span class="price-currency">{{ currency }}</span>
    </div>
  `,
  styles: [`
    .price-display {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      color: var(--color-on-surface);
    }
    .price-amount {
      font-size: 24px;
      font-weight: 700;
    }
    .price-currency {
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
  `]
})
export class PriceDisplayComponent {
  @Input({ required: true }) amount!: number;
  @Input() currency: string = 'EGP';
  @Input() ariaLabel?: string;
}
