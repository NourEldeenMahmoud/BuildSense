import { describe, it, expect } from 'vitest';
import {
  BUILDER_SLOT_ORDER,
  SLOT_DISPLAY_NAMES,
  createEmptySlotViewModels,
  createBuilderPageViewModel,
} from './builder-view.models';

describe('Builder view models', () => {
  describe('BUILDER_SLOT_ORDER', () => {
    it('contains exactly seven slots', () => {
      expect(BUILDER_SLOT_ORDER).toHaveLength(7);
    });

    it('orders slots as CPU, Motherboard, RAM, GPU, Storage, PSU, Case', () => {
      expect(BUILDER_SLOT_ORDER).toEqual([
        'cpu',
        'motherboard',
        'ram',
        'gpu',
        'storage',
        'psu',
        'case',
      ]);
    });

    it('has a display name for every slot key', () => {
      for (const key of BUILDER_SLOT_ORDER) {
        expect(SLOT_DISPLAY_NAMES[key]).toBeTruthy();
        expect(typeof SLOT_DISPLAY_NAMES[key]).toBe('string');
      }
    });
  });

  describe('createEmptySlotViewModels', () => {
    it('returns exactly seven slot view models', () => {
      const slots = createEmptySlotViewModels();
      expect(slots).toHaveLength(7);
    });

    it('assigns ordinals 1 through 7 in slot order', () => {
      const slots = createEmptySlotViewModels();
      const ordinals = slots.map((s) => s.ordinal);
      expect(ordinals).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('uses correct display names in order', () => {
      const slots = createEmptySlotViewModels();
      const names = slots.map((s) => s.displayName);
      expect(names).toEqual([
        'CPU',
        'Motherboard',
        'RAM',
        'GPU',
        'Storage',
        'PSU',
        'Case',
      ]);
    });

    it('sets selectedProduct to null for all slots', () => {
      const slots = createEmptySlotViewModels();
      for (const slot of slots) {
        expect(slot.selectedProduct).toBeNull();
      }
    });
  });

  describe('createBuilderPageViewModel', () => {
    it('has slotCount of 7', () => {
      const vm = createBuilderPageViewModel();
      expect(vm.summary.slotCount).toBe(7);
    });

    it('has filledCount of 0', () => {
      const vm = createBuilderPageViewModel();
      expect(vm.summary.filledCount).toBe(0);
    });

    it('has null totalEstimateLabel — no fabricated pricing', () => {
      const vm = createBuilderPageViewModel();
      expect(vm.summary.totalEstimateLabel).toBeNull();
    });

    it('has null compatibilityStatusLabel — no fabricated compatibility', () => {
      const vm = createBuilderPageViewModel();
      expect(vm.summary.compatibilityStatusLabel).toBeNull();
    });

    it('does not reference localStorage, API, or persistence', () => {
      const vm = createBuilderPageViewModel();
      const json = JSON.stringify(vm);
      expect(json).not.toContain('localStorage');
      expect(json).not.toContain('api');
      expect(json).not.toContain('persistence');
      expect(json).not.toContain('saved');
    });

    it('all slots have null selectedProduct', () => {
      const vm = createBuilderPageViewModel();
      for (const slot of vm.slots) {
        expect(slot.selectedProduct).toBeNull();
      }
    });
  });
});
