import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { BuilderSlotComponent } from './builder-slot.component';
import type { BuilderSlotViewModel } from '../builder-view.models';

function makeSlot(overrides: Partial<BuilderSlotViewModel> = {}): BuilderSlotViewModel {
  return {
    key: 'cpu',
    displayName: 'CPU',
    ordinal: 1,
    selectedProduct: null,
    ...overrides,
  };
}

describe('BuilderSlotComponent', () => {
  let fixture: ComponentFixture<BuilderSlotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuilderSlotComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BuilderSlotComponent);
    fixture.componentInstance.slot = makeSlot();
  });

  describe('empty slot', () => {
    it('renders the slot label', () => {
      fixture.detectChanges();
      const label = fixture.nativeElement.querySelector('.slot-label');
      expect(label?.textContent?.trim()).toBe('CPU');
    });

    it('renders the ordinal number', () => {
      fixture.detectChanges();
      const ordinal = fixture.nativeElement.querySelector('.slot-ordinal');
      expect(ordinal?.textContent?.trim()).toBe('1');
    });

    it('renders empty status', () => {
      fixture.detectChanges();
      const status = fixture.nativeElement.querySelector('.slot-status');
      expect(status?.textContent?.trim()).toBe('Empty');
    });

    it('has a group role with labelledby pointing to the slot label', () => {
      fixture.detectChanges();
      const slot = fixture.nativeElement.querySelector('.slot');
      expect(slot?.getAttribute('role')).toBe('group');
      const labelId = slot?.getAttribute('aria-labelledby');
      expect(labelId).toBe('slot-label-cpu');
    });

    it('label element has matching id', () => {
      fixture.detectChanges();
      const label = fixture.nativeElement.querySelector('.slot-label');
      expect(label?.id).toBe('slot-label-cpu');
    });

    it('renders different slot keys correctly', () => {
      fixture.componentInstance.slot = makeSlot({ key: 'gpu', displayName: 'GPU', ordinal: 4 });
      fixture.detectChanges();
      const label = fixture.nativeElement.querySelector('.slot-label');
      expect(label?.textContent?.trim()).toBe('GPU');
      const ordinal = fixture.nativeElement.querySelector('.slot-ordinal');
      expect(ordinal?.textContent?.trim()).toBe('4');
    });

    it('does not display any product data or pricing', () => {
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toContain('EGP');
      expect(html).not.toContain('price');
    });
  });

  describe('filled slot', () => {
    beforeEach(() => {
      fixture.componentInstance.slot = makeSlot({
        selectedProduct: {
          name: 'AMD Ryzen 7 7800X3D Processor',
          priceLabel: '—',
          availabilityLabel: 'Unavailable',
        },
      });
    });

    it('renders the product name', () => {
      fixture.detectChanges();
      const name = fixture.nativeElement.querySelector('.slot-product-name');
      expect(name?.textContent?.trim()).toBe('AMD Ryzen 7 7800X3D Processor');
    });

    it('renders the price label', () => {
      fixture.detectChanges();
      const price = fixture.nativeElement.querySelector('.slot-price');
      expect(price?.textContent?.trim()).toBe('—');
    });

    it('renders the availability label', () => {
      fixture.detectChanges();
      const avail = fixture.nativeElement.querySelector('.slot-availability');
      expect(avail?.textContent?.trim()).toBe('Unavailable');
    });

    it('does not render empty status', () => {
      fixture.detectChanges();
      const status = fixture.nativeElement.querySelector('.slot-status');
      expect(status).toBeNull();
    });

    it('still renders the slot label and ordinal', () => {
      fixture.detectChanges();
      const label = fixture.nativeElement.querySelector('.slot-label');
      expect(label?.textContent?.trim()).toBe('CPU');
      const ordinal = fixture.nativeElement.querySelector('.slot-ordinal');
      expect(ordinal?.textContent?.trim()).toBe('1');
    });

    it('applies slot-filled class', () => {
      fixture.detectChanges();
      const slot = fixture.nativeElement.querySelector('.slot');
      expect(slot?.classList.contains('slot-filled')).toBe(true);
    });

    it('does not fabricate compatibility or best claims', () => {
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toContain('Compatible');
      expect(html).not.toContain('Best');
      expect(html).not.toContain('Recommended');
    });
  });
});
