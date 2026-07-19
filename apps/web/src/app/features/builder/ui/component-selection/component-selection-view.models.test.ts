import { describe, it, expect } from 'vitest';
import { mapCandidatesToSelectionViewModel } from './component-selection-view.models';
import type { CandidateCompatibilityGroupDto, CandidateProductDto } from '@buildsense/contracts';

function product(overrides: Partial<CandidateProductDto>): CandidateProductDto {
  return {
    productId: overrides.productId ?? 'test',
    name: overrides.name ?? 'Test Product',
    brand: overrides.brand ?? 'TestBrand',
    model: overrides.model ?? 'Model',
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    price: overrides.price ?? 1000,
    sourceUrl: overrides.sourceUrl ?? 'https://example.com',
    storeCode: overrides.storeCode ?? 'SIGMA',
    availability: overrides.availability ?? 'IN_STOCK',
    offers: overrides.offers ?? [
      { storeCode: 'SIGMA', price: overrides.price ?? 1000, currency: null, availability: 'IN_STOCK', sourceUrl: overrides.sourceUrl ?? 'https://example.com' },
    ],
  };
}

describe('mapCandidatesToSelectionViewModel', () => {
  const SLOT_KEY = 'cpu' as const;

  it('maps a single UNKNOWN group with products', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'UNKNOWN',
        products: [
          product({ productId: 'p1', name: 'CPU Alpha', price: 15000, brand: 'AMD', model: 'Ryzen 5 7600', sourceUrl: 'https://example.com/1' }),
        ],
        topReasons: [],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups, 1, 1, 1);

    expect(vm.slotDisplayName).toBe('CPU');
    expect(vm.totalItems).toBe(1);
    expect(vm.groups).toHaveLength(1);
    expect(vm.groups[0]!.status).toBe('UNKNOWN');
    expect(vm.groups[0]!.statusLabel).toBe('Unknown Compatibility');
    expect(vm.groups[0]!.topReasons).toEqual([]);
    expect(vm.groups[0]!.candidates).toHaveLength(1);
    expect(vm.groups[0]!.candidates[0]!.name).toBe('CPU Alpha');
    expect(vm.groups[0]!.candidates[0]!.brand).toBe('AMD');
    expect(vm.groups[0]!.candidates[0]!.model).toBe('Ryzen 5 7600');
  });

  it('maps COMPATIBLE_WITH_WARNINGS group with topReasons', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'COMPATIBLE_WITH_WARNINGS',
        products: [
          product({ productId: 'p2', name: 'CPU Beta', price: 20000, brand: 'Intel', sourceUrl: 'https://example.com/2' }),
        ],
        topReasons: ['RAM speed may exceed board maximum'],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups, 1, 1, 1);

    expect(vm.groups).toHaveLength(1);
    expect(vm.groups[0]!.status).toBe('COMPATIBLE_WITH_WARNINGS');
    expect(vm.groups[0]!.statusLabel).toBe('Compatible with Warnings');
    expect(vm.groups[0]!.topReasons).toEqual(['RAM speed may exceed board maximum']);
    expect(vm.groups[0]!.candidates).toHaveLength(1);
    expect(vm.groups[0]!.candidates[0]!.name).toBe('CPU Beta');
  });

  it('maps all four groups in stable order', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'COMPATIBLE',
        products: [product({ productId: 'c1', name: 'C1', price: 1000 })],
        topReasons: [],
      },
      {
        status: 'COMPATIBLE_WITH_WARNINGS',
        products: [product({ productId: 'w1', name: 'W1', price: 2000 })],
        topReasons: ['Warning reason'],
      },
      {
        status: 'UNKNOWN',
        products: [product({ productId: 'u1', name: 'U1', price: 3000 })],
        topReasons: [],
      },
      {
        status: 'INCOMPATIBLE',
        products: [product({ productId: 'i1', name: 'I1', price: 4000 })],
        topReasons: ['Socket mismatch'],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups, 4, 1, 1);

    expect(vm.groups).toHaveLength(4);
    expect(vm.groups.map((g) => g.status)).toEqual([
      'COMPATIBLE',
      'COMPATIBLE_WITH_WARNINGS',
      'UNKNOWN',
      'INCOMPATIBLE',
    ]);
    const allCandidateIds = vm.groups.flatMap((g) => g.candidates.map((c) => c.id));
    expect(allCandidateIds).toEqual(['c1', 'w1', 'u1', 'i1']);
  });

  it('omits empty groups', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'UNKNOWN',
        products: [product({ productId: 'u1', name: 'U1' })],
        topReasons: [],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups, 1, 1, 1);

    expect(vm.groups).toHaveLength(1);
    expect(vm.groups[0]!.status).toBe('UNKNOWN');
  });

  it('maps topReasons from each group without inventing reasons', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'UNKNOWN',
        products: [product({ productId: 'u1', name: 'U1' })],
        topReasons: [],
      },
      {
        status: 'COMPATIBLE_WITH_WARNINGS',
        products: [product({ productId: 'w1', name: 'W1', price: 2000 })],
        topReasons: ['First reason', 'Second reason'],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups, 2, 1, 1);

    expect(vm.groups[0]!.topReasons).toEqual([]);
    expect(vm.groups[1]!.topReasons).toEqual(['First reason', 'Second reason']);
  });

  it('preserves backward compatibility with existing 3-group responses', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'UNKNOWN',
        products: [
          product({ productId: 'p1', name: 'CPU' }),
        ],
        topReasons: [],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups, 1, 1, 1);

    expect(vm.slotDisplayName).toBe('CPU');
    expect(vm.totalItems).toBe(1);
    expect(vm.groups).toHaveLength(1);
    expect(vm.groups[0]!.statusLabel).toBe('Unknown Compatibility');
  });

  it('maps offers from product DTO', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'COMPATIBLE',
        products: [
          product({
            productId: 'p1',
            name: 'CPU',
            price: 15000,
            storeCode: 'SIGMA',
            offers: [
              { storeCode: 'SIGMA', price: 15000, currency: null, availability: 'IN_STOCK', sourceUrl: 'https://sigma.com/1' },
              { storeCode: 'EL_NOUR', price: 16000, currency: null, availability: 'IN_STOCK', sourceUrl: 'https://elnour.com/1' },
            ],
          }),
        ],
        topReasons: [],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups, 1, 1, 1);
    const candidate = vm.groups[0]!.candidates[0]!;

    expect(candidate.offers).toHaveLength(2);
    expect(candidate.offers[0]!.storeLabel).toBe('Sigma Computer');
    expect(candidate.offers[1]!.storeLabel).toBe('El Nour Tech');
    expect(candidate.storeLabel).toBe('Sigma Computer');
  });

  it('maps actual brand and model, not storeCode', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'COMPATIBLE',
        products: [
          product({ productId: 'p1', name: 'CPU', brand: 'AMD', model: 'Ryzen 7 7800X3D', storeCode: 'SIGMA' }),
        ],
        topReasons: [],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups, 1, 1, 1);
    const candidate = vm.groups[0]!.candidates[0]!;

    expect(candidate.brand).toBe('AMD');
    expect(candidate.model).toBe('Ryzen 7 7800X3D');
    expect(candidate.storeLabel).toBe('Sigma Computer');
  });

  it('populates pagination fields', () => {
    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, [], 42, 2, 3);

    expect(vm.totalItems).toBe(42);
    expect(vm.page).toBe(2);
    expect(vm.totalPages).toBe(3);
    expect(vm.hasNextPage).toBe(true);
  });

  it('hasNextPage is false on last page', () => {
    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, [], 10, 3, 3);
    expect(vm.hasNextPage).toBe(false);
  });
});
