import { Component, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-aria-live',
  standalone: true,
  inputs: ['message', 'politeness'],
  template: `
    <div 
      class="sr-only" 
      [attr.aria-live]="politeness" 
      aria-atomic="true">
      {{ currentMessage }}
    </div>
  `,
  styles: [`
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
export class AriaLiveComponent implements OnChanges {
  message!: string;
  politeness: 'polite' | 'assertive' = 'polite';
  currentMessage = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['message']) {
      this.currentMessage = '';
      setTimeout(() => {
        this.currentMessage = this.message;
      }, 50);
    }
  }
}
