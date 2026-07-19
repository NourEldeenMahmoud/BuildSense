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

    it('offers the existing slot selection flow', () => {
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('.slot-select');
      expect(button?.getAttribute('aria-label')).toBe('Add CPU');
    });

    it('renders empty status', () => {
      fixture.detectChanges();
      const status = fixture.nativeElement.querySelector('.slot-status');
      expect(status?.textContent?.trim()).toBe('Required — not selected');
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
      const button = fixture.nativeElement.querySelector('.slot-select');
      expect(button?.getAttribute('aria-label')).toBe('Add GPU');
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

    it('still renders the slot label and replace action', () => {
      fixture.detectChanges();
      const label = fixture.nativeElement.querySelector('.slot-label');
      expect(label?.textContent?.trim()).toBe('CPU');
      const button = fixture.nativeElement.querySelector('.slot-select');
      expect(button?.getAttribute('aria-label')).toBe('Replace CPU');
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

    it('renders supplied compatibility evidence accessibly', () => {
      fixture.componentInstance.slot = makeSlot({
        selectedProduct: {
          name: 'AMD Ryzen 7 7800X3D Processor',
          priceLabel: '—',
          availabilityLabel: 'Unavailable',
        },
        compatibilityStatus: 'INCOMPATIBLE',
        compatibilityStatusLabel: 'Incompatible',
        triggeredRuleIds: ['CMP-CPU-MB-001'],
        topReasons: ['CPU socket AM4 does not match AM5'],
      });
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.compatibility-badge');
      expect(badge?.textContent?.trim()).toBe('Incompatible');
      expect(badge?.getAttribute('aria-label')).toBe('Compatibility: Incompatible');
      expect(fixture.nativeElement.textContent).toContain('CPU socket AM4 does not match AM5');
      expect(fixture.nativeElement.textContent).toContain('CMP-CPU-MB-001');
    });

    it('renders missingFactKeys for UNKNOWN with keys', () => {
      fixture.componentInstance.slot = makeSlot({
        selectedProduct: {
          name: 'AMD Ryzen 5 7600',
          priceLabel: '12,000 EGP',
          availabilityLabel: 'In Stock',
        },
        compatibilityStatus: 'UNKNOWN',
        compatibilityStatusLabel: 'Unknown',
        triggeredRuleIds: [],
        topReasons: ['Insufficient data to evaluate compatibility'],
        missingFactKeys: ['cpu.socket', 'mb.socket', 'ram.ddr_generation'],
      });
      fixture.detectChanges();
      const missingFacts = fixture.nativeElement.querySelector('.missing-facts');
      expect(missingFacts).toBeTruthy();
      expect(missingFacts.getAttribute('aria-label')).toBe('Missing compatibility facts');
      expect(missingFacts.textContent).toContain('Missing compatibility facts');
      expect(missingFacts.textContent).toContain('cpu.socket');
      expect(missingFacts.textContent).toContain('mb.socket');
      expect(missingFacts.textContent).toContain('ram.ddr_generation');
      // Also verify reason is still visible
      expect(fixture.nativeElement.textContent).toContain('Insufficient data to evaluate compatibility');
    });

    it('does not render missing-facts block for UNKNOWN with empty keys', () => {
      fixture.componentInstance.slot = makeSlot({
        selectedProduct: {
          name: 'Generic GPU',
          priceLabel: '—',
          availabilityLabel: 'Unknown',
        },
        compatibilityStatus: 'UNKNOWN',
        compatibilityStatusLabel: 'Unknown',
        triggeredRuleIds: [],
        topReasons: ['No rules matched for this configuration'],
        missingFactKeys: [],
      });
      fixture.detectChanges();
      const missingFacts = fixture.nativeElement.querySelector('.missing-facts');
      expect(missingFacts).toBeNull();
      // Reason should still be visible
      expect(fixture.nativeElement.textContent).toContain('No rules matched for this configuration');
    });

    it('does not render missing-facts block for COMPATIBLE even with malformed keys', () => {
      fixture.componentInstance.slot = makeSlot({
        selectedProduct: {
          name: 'AMD Ryzen 5 7600',
          priceLabel: '12,000 EGP',
          availabilityLabel: 'In Stock',
        },
        compatibilityStatus: 'COMPATIBLE',
        compatibilityStatusLabel: 'Compatible',
        triggeredRuleIds: [],
        topReasons: [],
        missingFactKeys: ['cpu.socket'] as unknown as readonly string[],
      });
      fixture.detectChanges();
      const missingFacts = fixture.nativeElement.querySelector('.missing-facts');
      expect(missingFacts).toBeNull();
    });

    it('does not render missing-facts block for INCOMPATIBLE even with malformed keys', () => {
      fixture.componentInstance.slot = makeSlot({
        selectedProduct: {
          name: 'Intel Core i7-14700K',
          priceLabel: '18,000 EGP',
          availabilityLabel: 'In Stock',
        },
        compatibilityStatus: 'INCOMPATIBLE',
        compatibilityStatusLabel: 'Incompatible',
        triggeredRuleIds: ['CMP-CPU-MB-001'],
        topReasons: ['Socket mismatch'],
        missingFactKeys: ['cpu.socket'] as unknown as readonly string[],
      });
      fixture.detectChanges();
      const missingFacts = fixture.nativeElement.querySelector('.missing-facts');
      expect(missingFacts).toBeNull();
    });
  });
});
