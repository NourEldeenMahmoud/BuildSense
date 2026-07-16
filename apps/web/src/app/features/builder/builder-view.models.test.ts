import { describe, it, expect } from 'vitest';
import {
  BUILDER_SLOT_ORDER,
  SLOT_DISPLAY_NAMES,
  createEmptySlotViewModels,
  createBuilderPageViewModel,
  mapBuildToSlotViewModels,
  mapBuildToSummaryViewModel,
} from './builder-view.models';
import type { BuildDto } from '@buildsense/contracts';

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

  // ---------------------------------------------------------------------------
  // mapBuildToSlotViewModels
  // ---------------------------------------------------------------------------

  describe('mapBuildToSlotViewModels', () => {
    const makeBuild = (overrides: Partial<BuildDto> = {}): BuildDto => ({
      publicId: 'test-build-id',
      name: 'Test Build',
      version: 1,
      items: [],
      compatibility: { overallStatus: 'UNKNOWN', slots: [] },
      pricing: { totalPrice: null, itemCount: 0 },
      createdAt: '2025-01-15T10:00:00.000Z',
      updatedAt: '2025-01-15T10:00:00.000Z',
      ...overrides,
    });

    it('returns exactly seven slots for an empty build', () => {
      const slots = mapBuildToSlotViewModels(makeBuild());
      expect(slots).toHaveLength(7);
    });

    it('all selectedProduct are null for empty build', () => {
      const slots = mapBuildToSlotViewModels(makeBuild());
      for (const slot of slots) {
        expect(slot.selectedProduct).toBeNull();
      }
    });

    it('populates selectedProduct for a filled CPU slot', () => {
      const build = makeBuild({
        items: [
          {
            productId: 'prod-1',
            slot: 'cpu',
            quantity: 1,
            unitPrice: 15000,
            totalPrice: 15000,
            productName: 'AMD Ryzen 5 7600',
            thumbnailUrl: 'https://img.example.com/cpu.jpg',
            sourceUrl: 'https://sigma.com/item/cpu-1',
            storeCode: 'SIGMA',
          },
        ],
      });

      const slots = mapBuildToSlotViewModels(build);
      expect(slots[0]!.selectedProduct).not.toBeNull();
      expect(slots[0]!.selectedProduct!.name).toBe('AMD Ryzen 5 7600');
      expect(slots[0]!.selectedProduct!.priceLabel).toContain('15,000');
      expect(slots[0]!.selectedProduct!.availabilityLabel).toBe('SIGMA');
    });

    it('formats price with EGP suffix', () => {
      const build = makeBuild({
        items: [
          {
            productId: 'prod-1',
            slot: 'ram',
            quantity: 2,
            unitPrice: 5000,
            totalPrice: 10000,
            productName: 'DDR5 16GB',
            thumbnailUrl: null,
            sourceUrl: 'https://sigma.com/item/ram-1',
            storeCode: 'SIGMA',
          },
        ],
      });

      const slots = mapBuildToSlotViewModels(build);
      // RAM is at index 2
      expect(slots[2]!.selectedProduct).not.toBeNull();
      expect(slots[2]!.selectedProduct!.priceLabel).toBe('10,000 EGP');
    });

    it('displays em-dash for null totalPrice', () => {
      const build = makeBuild({
        items: [
          {
            productId: 'prod-1',
            slot: 'gpu',
            quantity: 1,
            unitPrice: null,
            totalPrice: null,
            productName: 'RTX 4080',
            thumbnailUrl: null,
            sourceUrl: 'https://sigma.com/item/gpu-1',
            storeCode: 'SIGMA',
          },
        ],
      });

      const slots = mapBuildToSlotViewModels(build);
      // GPU is at index 3
      expect(slots[3]!.selectedProduct).not.toBeNull();
      expect(slots[3]!.selectedProduct!.priceLabel).toBe('\u2014');
    });

    it('ordinals remain 1-7 in slot order', () => {
      const slots = mapBuildToSlotViewModels(makeBuild());
      expect(slots.map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('display names match BUILDER_SLOT_ORDER', () => {
      const slots = mapBuildToSlotViewModels(makeBuild());
      expect(slots.map((s) => s.key)).toEqual([...BUILDER_SLOT_ORDER]);
    });

    it('does not include Cooler or Case Fans slots', () => {
      const slots = mapBuildToSlotViewModels(makeBuild());
      const keys = slots.map((s) => s.key);
      expect(keys).not.toContain('cooler');
      expect(keys).not.toContain('case-fans');
      expect(keys).toHaveLength(7);
    });

    it('maps real compatibility evidence to the matching slot', () => {
      const slots = mapBuildToSlotViewModels(makeBuild({
        compatibility: {
          overallStatus: 'INCOMPATIBLE',
          slots: [{
            slot: 'cpu',
            status: 'INCOMPATIBLE',
            triggeredRuleIds: ['CMP-CPU-MB-001'],
            topReasons: ['CPU socket AM4 does not match AM5'],
          }],
        },
      }));
      expect(slots[0]?.compatibilityStatusLabel).toBe('Incompatible');
      expect(slots[0]?.triggeredRuleIds).toEqual(['CMP-CPU-MB-001']);
      expect(slots[0]?.topReasons).toEqual(['CPU socket AM4 does not match AM5']);
      expect(slots[1]?.compatibilityStatus).toBe('UNKNOWN');
    });
  });

  // ---------------------------------------------------------------------------
  // mapBuildToSummaryViewModel
  // ---------------------------------------------------------------------------

  describe('mapBuildToSummaryViewModel', () => {
    const makeBuild = (overrides: Partial<BuildDto> = {}): BuildDto => ({
      publicId: 'test-build-id',
      name: 'Test Build',
      version: 1,
      items: [],
      compatibility: { overallStatus: 'UNKNOWN', slots: [] },
      pricing: { totalPrice: null, itemCount: 0 },
      createdAt: '2025-01-15T10:00:00.000Z',
      updatedAt: '2025-01-15T10:00:00.000Z',
      ...overrides,
    });

    it('returns slotCount of 7 for empty build', () => {
      const summary = mapBuildToSummaryViewModel(makeBuild());
      expect(summary.slotCount).toBe(7);
    });

    it('filledCount is 0 for empty build', () => {
      const summary = mapBuildToSummaryViewModel(makeBuild());
      expect(summary.filledCount).toBe(0);
    });

    it('totalEstimateLabel is em-dash for null totalPrice', () => {
      const summary = mapBuildToSummaryViewModel(makeBuild());
      expect(summary.totalEstimateLabel).toBe('\u2014');
    });

    it('totalEstimateLabel formats totalPrice with EGP', () => {
      const build = makeBuild({
        pricing: { totalPrice: 52000, itemCount: 4 },
      });
      const summary = mapBuildToSummaryViewModel(build);
      expect(summary.totalEstimateLabel).toBe('52,000 EGP');
    });

    it('compatibilityStatusLabel is "Unknown" for UNKNOWN status', () => {
      const summary = mapBuildToSummaryViewModel(makeBuild());
      expect(summary.compatibilityStatusLabel).toBe('Unknown');
    });

    it('compatibilityStatusLabel is "Compatible" for COMPATIBLE status', () => {
      const build = makeBuild({
        compatibility: { overallStatus: 'COMPATIBLE', slots: [] },
      });
      const summary = mapBuildToSummaryViewModel(build);
      expect(summary.compatibilityStatusLabel).toBe('Compatible');
    });

    it('compatibilityStatusLabel is "Incompatible" for INCOMPATIBLE status', () => {
      const build = makeBuild({
        compatibility: { overallStatus: 'INCOMPATIBLE', slots: [] },
      });
      const summary = mapBuildToSummaryViewModel(build);
      expect(summary.compatibilityStatusLabel).toBe('Incompatible');
    });

    it('compatibilityStatusLabel is "Warning" for WARNING status', () => {
      const build = makeBuild({
        compatibility: { overallStatus: 'WARNING', slots: [] },
      });
      const summary = mapBuildToSummaryViewModel(build);
      expect(summary.compatibilityStatusLabel).toBe('Warning');
    });

    it('counts distinct filled slots correctly', () => {
      const build = makeBuild({
        items: [
          {
            productId: 'p1',
            slot: 'cpu',
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
            productName: 'CPU',
            thumbnailUrl: null,
            sourceUrl: 'url',
            storeCode: 'SIGMA',
          },
          {
            productId: 'p2',
            slot: 'ram',
            quantity: 2,
            unitPrice: 500,
            totalPrice: 1000,
            productName: 'RAM',
            thumbnailUrl: null,
            sourceUrl: 'url',
            storeCode: 'SIGMA',
          },
          {
            productId: 'p3',
            slot: 'ram',
            quantity: 2,
            unitPrice: 500,
            totalPrice: 1000,
            productName: 'RAM 2',
            thumbnailUrl: null,
            sourceUrl: 'url',
            storeCode: 'SIGMA',
          },
        ],
      });

      // 3 items but only 2 distinct slots (cpu, ram)
      const summary = mapBuildToSummaryViewModel(build);
      expect(summary.filledCount).toBe(2);
      expect(summary.slotCount).toBe(7);
    });
  });
});
