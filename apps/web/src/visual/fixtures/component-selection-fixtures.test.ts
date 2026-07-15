import { describe, it, expect } from 'vitest';
import { FIXTURE_SELECTION_CPU } from './component-selection-fixtures';

describe('Component selection fixtures', () => {
  it('has a non-empty slot display name', () => {
    expect(FIXTURE_SELECTION_CPU.slotDisplayName).toBeTruthy();
  });

  it('has at least 3 candidates', () => {
    expect(FIXTURE_SELECTION_CPU.candidates.length).toBeGreaterThanOrEqual(3);
  });

  it('every candidate has id, name, brand with honest placeholder price and availability', () => {
    for (const c of FIXTURE_SELECTION_CPU.candidates) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.brand).toBeTruthy();
      expect(c.priceLabel).toBe('—');
      expect(c.availabilityLabel).toBe('Unavailable');
    }
  });

  it('candidate IDs are visibly fixture-only', () => {
    for (const c of FIXTURE_SELECTION_CPU.candidates) {
      expect(c.id).toMatch(/^fixture-/);
    }
  });

  it('does not contain invented prices, active selection behavior, or compatibility claims', () => {
    const json = JSON.stringify(FIXTURE_SELECTION_CPU);
    expect(json).not.toContain('EGP');
    expect(json).not.toContain('selected');
    expect(json).not.toContain('Compatible');
    expect(json).not.toContain('Best');
  });
});
