import { describe, it, expect } from 'vitest';
import { FIXTURE_BUILDER_SLOTS, FIXTURE_BUILDER_SUMMARY, FIXTURE_BUILDER_PAGE_VM } from './builder-fixtures';

describe('Builder fixtures', () => {
  it('has exactly seven slots', () => {
    expect(FIXTURE_BUILDER_SLOTS).toHaveLength(7);
  });

  it('slots are in canonical order', () => {
    const keys = FIXTURE_BUILDER_SLOTS.map((s) => s.key);
    expect(keys).toEqual(['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case']);
  });

  it('every slot has a non-empty selectedProduct with honest placeholders', () => {
    for (const slot of FIXTURE_BUILDER_SLOTS) {
      expect(slot.selectedProduct).not.toBeNull();
      expect(slot.selectedProduct!.name).toBeTruthy();
      expect(slot.selectedProduct!.priceLabel).toBe('—');
      expect(slot.selectedProduct!.availabilityLabel).toBe('Unavailable');
    }
  });

  it('summary has filledCount of 7', () => {
    expect(FIXTURE_BUILDER_SUMMARY.filledCount).toBe(7);
  });

  it('summary has null totalEstimateLabel — no invented pricing', () => {
    expect(FIXTURE_BUILDER_SUMMARY.totalEstimateLabel).toBeNull();
  });

  it('summary has null compatibilityStatusLabel — no invented compatibility', () => {
    expect(FIXTURE_BUILDER_SUMMARY.compatibilityStatusLabel).toBeNull();
  });

  it('page VM has matching slot count and summary slotCount', () => {
    expect(FIXTURE_BUILDER_PAGE_VM.slots).toHaveLength(FIXTURE_BUILDER_PAGE_VM.summary.slotCount);
  });

  it('fixture identifiers are visibly fixture-only', () => {
    const json = JSON.stringify(FIXTURE_BUILDER_PAGE_VM);
    expect(json).not.toContain('real-');
    expect(json).not.toContain('actual');
    expect(json).not.toContain('production');
  });

  it('does not contain invented prices, EGP values, or compatibility claims', () => {
    const json = JSON.stringify(FIXTURE_BUILDER_PAGE_VM);
    expect(json).not.toContain('EGP');
    expect(json).not.toContain('"Pending"');
    expect(json.toLowerCase()).not.toContain('"best"');
    expect(json.toLowerCase()).not.toContain('"savings"');
    expect(json.toLowerCase()).not.toContain('"fresh"');
  });
});
