import { Component, EventEmitter, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-overlay',
  standalone: true,
  imports: [CommonModule],
  inputs: ['ariaLabel', 'title', 'isOpen', 'closeOnBackdropClick'],
  outputs: ['isOpenChange'],
  host: {
    '(document:keydown.escape)': 'onEscapeKey($event)',
    '(document:keydown.tab)': 'onTabKey($event)'
  },
  template: `
    <div 
      *ngIf="isOpen"
      class="overlay-backdrop"
      (click)="onBackdropClick()">
      <div 
        #dialogRef
        id="overlay-dialog"
        class="overlay-content"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="ariaLabel"
        tabindex="-1"
        (click)="$event.stopPropagation()">
        
        <div class="overlay-header">
          <h2 class="overlay-title tech-font" *ngIf="title">{{ title }}</h2>
          <button 
            #closeBtn
            id="overlay-close-btn"
            class="overlay-close-btn" 
            aria-label="Close overlay" 
            (click)="close()">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="overlay-body">
          <ng-content></ng-content>
        </div>
        
        <div class="overlay-footer">
          <ng-content select="[footer]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(18, 20, 18, 0.8);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-gutter);
    }
    .overlay-content {
      background-color: var(--color-surface);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-none);
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 48px rgba(0,0,0,0.5);
    }
    .overlay-header {
      padding: var(--space-gutter);
      border-bottom: var(--border-width) solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .overlay-title {
      margin: 0;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .overlay-close-btn {
      background: transparent;
      border: none;
      color: var(--color-on-surface-variant);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }
    .overlay-close-btn:hover, .overlay-close-btn:focus-visible {
      color: var(--color-primary);
      outline: none;
    }
    .overlay-close-btn svg {
      width: 20px;
      height: 20px;
    }
    .overlay-body {
      padding: var(--space-gutter);
      overflow-y: auto;
      flex: 1;
    }
    .overlay-footer {
      padding: var(--space-gutter);
      border-top: var(--border-width) solid var(--color-border);
      display: flex;
      justify-content: flex-end;
      gap: var(--space-gutter);
    }
    .overlay-footer:empty {
      display: none;
    }
  `]
})
export class OverlayComponent implements OnChanges, OnDestroy {
  ariaLabel!: string;
  title?: string;
  isOpen = false;
  closeOnBackdropClick = true;
  isOpenChange = new EventEmitter<boolean>();
  
  private previousActiveElement?: HTMLElement;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.open();
      } else {
        this.restoreState();
      }
    }
  }

  onEscapeKey(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  onTabKey(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    const dialog = document.getElementById('overlay-dialog');
    if (!dialog) return;

    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }

  ngOnDestroy(): void {
    this.restoreState();
  }

  open(): void {
    this.previousActiveElement = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const btn = document.getElementById('overlay-close-btn');
      if (btn) {
        btn.focus();
      }
    });
  }

  close(): void {
    this.isOpenChange.emit(false);
  }

  onBackdropClick(): void {
    if (this.closeOnBackdropClick) {
      this.close();
    }
  }

  private restoreState(): void {
    document.body.style.overflow = '';
    if (this.previousActiveElement) {
      this.previousActiveElement.focus();
      delete this.previousActiveElement;
    }
  }
}
