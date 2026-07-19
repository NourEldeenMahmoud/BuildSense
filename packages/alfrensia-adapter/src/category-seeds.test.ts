import { describe, it, expect } from 'vitest';
import {
  ALFRENSIA_CATEGORY_SEEDS,
  getAllCategorySeeds,
  getCategorySeedById,
} from './category-seeds.js';

describe('category-seeds', () => {
  it('has exactly 9 seeds covering all PC-component categories', () => {
    expect(ALFRENSIA_CATEGORY_SEEDS).toHaveLength(9);
  });

  it('all seeds have required fields', () => {
    for (const seed of ALFRENSIA_CATEGORY_SEEDS) {
      expect(seed.id).toBeTruthy();
      expect(seed.name).toBeTruthy();
      expect(seed.url).toBeTruthy();
      expect(seed.url).toMatch(/^product-category\//);
    }
  });

  it('monitors seed still exists and points to monitors category', () => {
    const monitors = getCategorySeedById('monitors');
    expect(monitors).toBeDefined();
    expect(monitors!.url).toBe('product-category/monitors/');
  });

  it('getAllCategorySeeds returns a copy', () => {
    const seeds = getAllCategorySeeds();
    expect(seeds).toHaveLength(9);
    // Mutating the returned array should not affect the original
    seeds.pop();
    expect(ALFRENSIA_CATEGORY_SEEDS).toHaveLength(9);
  });

  it('getCategorySeedById returns undefined for unknown id', () => {
    expect(getCategorySeedById('unknown-id')).toBeUndefined();
  });

  it('all expected category IDs are present', () => {
    const expectedIds = [
      'processor',
      'graphics-card',
      'motherboard',
      'ram',
      'power-supply',
      'cases',
      'air-liquid-cooling',
      'case-fans',
      'monitors',
    ];
    const actualIds = ALFRENSIA_CATEGORY_SEEDS.map((s) => s.id);
    expect(actualIds).toEqual(expectedIds);
  });

  it('all seeds default to enabled', () => {
    for (const seed of ALFRENSIA_CATEGORY_SEEDS) {
      expect(seed.enabled).toBeUndefined(); // undefined means enabled
    }
  });
});
