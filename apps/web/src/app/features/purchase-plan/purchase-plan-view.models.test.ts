import { describe, it, expect } from 'vitest';
import { createPurchasePlanPageViewModel } from './purchase-plan-view.models';

describe('Purchase Plan view models', () => {
  describe('createPurchasePlanPageViewModel', () => {
    it('marks hasBuild as false — no fabricated build state', () => {
      const vm = createPurchasePlanPageViewModel();
      expect(vm.hasBuild).toBe(false);
    });

    it('has componentCount of 0', () => {
      const vm = createPurchasePlanPageViewModel();
      expect(vm.componentCount).toBe(0);
    });

    it('has null totalPriceLabel — no fabricated pricing', () => {
      const vm = createPurchasePlanPageViewModel();
      expect(vm.totalPriceLabel).toBeNull();
    });

    it('has null compatibilityStatusLabel — no fabricated compatibility', () => {
      const vm = createPurchasePlanPageViewModel();
      expect(vm.compatibilityStatusLabel).toBeNull();
    });

    it('has empty componentRows', () => {
      const vm = createPurchasePlanPageViewModel();
      expect(vm.componentRows).toEqual([]);
    });

    it('does not reference localStorage, API, persistence, or compatibility', () => {
      const vm = createPurchasePlanPageViewModel();
      const json = JSON.stringify(vm);
      expect(json).not.toContain('localStorage');
      expect(json).not.toContain('api');
      expect(json).not.toContain('persistence');
      expect(json).not.toContain('saved');
    });

    it('does not contain fixture product data', () => {
      const vm = createPurchasePlanPageViewModel();
      const json = JSON.stringify(vm);
      expect(json).not.toContain('Ryzen');
      expect(json).not.toContain('Intel');
      expect(json).not.toContain('EGP');
    });
  });
});
