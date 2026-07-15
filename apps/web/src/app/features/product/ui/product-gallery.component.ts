import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-gallery',
  standalone: true,
  imports: [CommonModule],
  inputs: ['images', 'altText'],
  outputs: ['imageSelected'],
  template: `
    <!-- Primary image -->
    <div class="gallery-main">
      @if (displayUrl()) {
        <img
          class="gallery-primary-image"
          [src]="displayUrl()"
          [alt]="altText"
          (error)="onImageError()"
        />
      } @else {
        <div class="gallery-image-fallback" role="img" [attr.aria-label]="altText + ' (no image)'">
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span class="gallery-fallback-text">No image available</span>
        </div>
      }
    </div>

    <!-- Thumbnails -->
    @if (images && images.length > 1) {
      <div
        class="gallery-thumbnails"
        role="tablist"
        aria-label="Product images"
      >
        @for (url of images; track url; let idx = $index) {
          <button
            class="gallery-thumb"
            [class.active]="idx === selectedIndex()"
            [attr.aria-selected]="idx === selectedIndex()"
            [attr.aria-label]="'Image ' + (idx + 1) + ' of ' + images.length"
            role="tab"
            (click)="selectImage(idx)"
            (keydown)="onKeyDown($event, idx)"
            type="button"
          >
            @if (!thumbErrors().has(idx)) {
              <img
                [src]="url"
                [alt]="'Thumbnail ' + (idx + 1)"
                (error)="onThumbError(idx)"
                class="gallery-thumb-img"
              />
            } @else {
              <div class="gallery-thumb-fallback" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                </svg>
              </div>
            }
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .gallery-main {
      width: 100%;
      aspect-ratio: 1;
      background: var(--color-surface-container);
      border: var(--border-width) solid var(--color-border);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .gallery-primary-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .gallery-image-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--color-on-surface-variant);
    }
    .gallery-image-fallback svg {
      width: 48px;
      height: 48px;
      opacity: 0.4;
    }
    .gallery-fallback-text {
      font-size: 13px;
      font-family: var(--font-mono);
    }
    .gallery-thumbnails {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .gallery-thumb {
      flex: 0 0 64px;
      width: 64px;
      height: 64px;
      border: var(--border-width) solid var(--color-border);
      background: var(--color-surface-container);
      cursor: pointer;
      padding: 0;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.2s;
    }
    .gallery-thumb:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    .gallery-thumb.active {
      border-color: var(--color-primary);
    }
    .gallery-thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .gallery-thumb-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-on-surface-variant);
      opacity: 0.3;
    }
    .gallery-thumb-fallback svg {
      width: 20px;
      height: 20px;
    }
    @media (max-width: 767px) {
      .gallery-thumb {
        flex: 0 0 48px;
        width: 48px;
        height: 48px;
      }
    }
  `],
})
export class ProductGalleryComponent {
  images: string[] = [];
  altText = 'Product image';
  imageSelected = { emit: (_index: number): void => {} };

  selectedIndex = signal(0);
  thumbErrors = signal<Set<number>>(new Set());
  mainImageError = signal(false);

  displayUrl(): string | null {
    if (this.mainImageError()) return null;
    if (!this.images || this.images.length === 0) return null;
    return this.images[this.selectedIndex()] ?? this.images[0] ?? null;
  }

  selectImage(index: number): void {
    if (index >= 0 && index < this.images.length) {
      this.selectedIndex.set(index);
      this.mainImageError.set(false);
      this.imageSelected.emit(index);
    }
  }

  onImageError(): void {
    this.mainImageError.set(true);
  }

  onThumbError(index: number): void {
    this.thumbErrors.update((errors) => {
      const next = new Set(errors);
      next.add(index);
      return next;
    });
  }

  onKeyDown(event: KeyboardEvent, currentIndex: number): void {
    const total = this.images.length;
    if (total <= 1) return;

    let next = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (currentIndex + 1) % total;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (currentIndex - 1 + total) % total;
    } else {
      return;
    }

    event.preventDefault();
    this.selectImage(next);
    const thumbs = (event.currentTarget as HTMLElement)
      ?.parentElement?.querySelectorAll('[role="tab"]');
    (thumbs?.[next] as HTMLElement)?.focus();
  }
}
