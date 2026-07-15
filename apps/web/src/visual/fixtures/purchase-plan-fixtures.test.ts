import { describe, it, expect } from 'vitest';
import { FIXTURE_PURCHASE_PLAN_VM, FIXTURE_PURCHASE_ROWS } from './purchase-plan-fixtures';

describe('Purchase plan fixtures', () => {
  it('hasBuild is true', () => {
    expect(FIXTURE_PURCHASE_PLAN_VM.hasBuild).toBe(true);
  });

  it('componentCount matches rows length', () => {
    expect(FIXTURE_PURCHASE_PLAN_VM.componentCount).toBe(FIXTURE_PURCHASE_ROWS.length);
  });

  it('has exactly 7 component rows', () => {
    expect(FIXTURE_PURCHASE_ROWS).toHaveLength(7);
  });

  it('rows are in canonical slot order', () => {
    const slots = FIXTURE_PURCHASE_ROWS.map((r) => r.slotDisplayName);
    expect(slots).toEqual(['CPU', 'Motherboard', 'RAM', 'GPU', 'Storage', 'PSU', 'Case']);
  });

  it('every row has a product name with honest placeholder price and availability', () => {
    for (const row of FIXTURE_PURCHASE_ROWS) {
      expect(row.productName).toBeTruthy();
      expect(row.priceLabel).toBe('—');
      expect(row.availabilityLabel).toBe('Unavailable');
    }
  });

  it('totalPriceLabel is null — no invented pricing', () => {
    expect(FIXTURE_PURCHASE_PLAN_VM.totalPriceLabel).toBeNull();
  });

  it('compatibilityStatusLabel is null — no invented compatibility', () => {
    expect(FIXTURE_PURCHASE_PLAN_VM.compatibilityStatusLabel).toBeNull();
  });

  it('does not contain active export, print, or checkout claims', () => {
    const json = JSON.stringify(FIXTURE_PURCHASE_PLAN_VM);
    expect(json).not.toContain('exported');
    expect(json).not.toContain('printed');
    expect(json).not.toContain('checkout');
    expect(json).not.toContain('payment');
  });

  it('does not contain invented prices, EGP values, or compatibility claims', () => {
    const json = JSON.stringify(FIXTURE_PURCHASE_PLAN_VM);
    expect(json).not.toContain('EGP');
    expect(json).not.toContain('"Pending"');
    expect(json.toLowerCase()).not.toContain('"best"');
    expect(json.toLowerCase()).not.toContain('"savings"');
    expect(json.toLowerCase()).not.toContain('"fresh"');
  });
});
