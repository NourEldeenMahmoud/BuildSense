import { describe, it, expect } from 'vitest';
import { mapCandidatesToSelectionViewModel } from './component-selection-view.models';
import type { CandidateCompatibilityGroupDto } from '@buildsense/contracts';

describe('mapCandidatesToSelectionViewModel', () => {
  const SLOT_KEY = 'cpu' as const;

  it('maps a single UNKNOWN group with products', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'UNKNOWN',
        products: [
          {
            productId: 'p1',
            name: 'CPU Alpha',
            thumbnailUrl: null,
            price: 15000,
            sourceUrl: 'https://example.com/1',
            storeCode: 'SIGMA',
          },
        ],
        topReasons: [],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups);

    expect(vm.slotDisplayName).toBe('CPU');
    expect(vm.candidates).toHaveLength(1);
    expect(vm.candidates[0]!.name).toBe('CPU Alpha');
    expect(vm.groups).toHaveLength(1);
    expect(vm.groups[0]!.status).toBe('UNKNOWN');
    expect(vm.groups[0]!.statusLabel).toBe('Unknown Compatibility');
    expect(vm.groups[0]!.topReasons).toEqual([]);
  });

  it('maps COMPATIBLE_WITH_WARNINGS group with topReasons', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'COMPATIBLE_WITH_WARNINGS',
        products: [
          {
            productId: 'p2',
            name: 'CPU Beta',
            thumbnailUrl: null,
            price: 20000,
            sourceUrl: 'https://example.com/2',
            storeCode: 'SIGMA',
          },
        ],
        topReasons: ['RAM speed may exceed board maximum'],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups);

    expect(vm.groups).toHaveLength(1);
    expect(vm.groups[0]!.status).toBe('COMPATIBLE_WITH_WARNINGS');
    expect(vm.groups[0]!.statusLabel).toBe('Compatible with Warnings');
    expect(vm.groups[0]!.topReasons).toEqual(['RAM speed may exceed board maximum']);
    expect(vm.candidates).toHaveLength(1);
    expect(vm.candidates[0]!.name).toBe('CPU Beta');
  });

  it('maps all four groups in stable order', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'COMPATIBLE',
        products: [{ productId: 'c1', name: 'C1', thumbnailUrl: null, price: 1000, sourceUrl: '', storeCode: 'SIGMA' }],
        topReasons: [],
      },
      {
        status: 'COMPATIBLE_WITH_WARNINGS',
        products: [{ productId: 'w1', name: 'W1', thumbnailUrl: null, price: 2000, sourceUrl: '', storeCode: 'SIGMA' }],
        topReasons: ['Warning reason'],
      },
      {
        status: 'UNKNOWN',
        products: [{ productId: 'u1', name: 'U1', thumbnailUrl: null, price: 3000, sourceUrl: '', storeCode: 'SIGMA' }],
        topReasons: [],
      },
      {
        status: 'INCOMPATIBLE',
        products: [{ productId: 'i1', name: 'I1', thumbnailUrl: null, price: 4000, sourceUrl: '', storeCode: 'SIGMA' }],
        topReasons: ['Socket mismatch'],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups);

    expect(vm.groups).toHaveLength(4);
    expect(vm.groups.map((g) => g.status)).toEqual([
      'COMPATIBLE',
      'COMPATIBLE_WITH_WARNINGS',
      'UNKNOWN',
      'INCOMPATIBLE',
    ]);
    expect(vm.candidates).toHaveLength(4);
    expect(vm.candidates.map((c) => c.id)).toEqual(['c1', 'w1', 'u1', 'i1']);
  });

  it('omits empty groups', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'UNKNOWN',
        products: [{ productId: 'u1', name: 'U1', thumbnailUrl: null, price: 1000, sourceUrl: '', storeCode: 'SIGMA' }],
        topReasons: [],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups);

    expect(vm.groups).toHaveLength(1);
    expect(vm.groups[0]!.status).toBe('UNKNOWN');
  });

  it('maps topReasons from each group without inventing reasons', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'UNKNOWN',
        products: [{ productId: 'u1', name: 'U1', thumbnailUrl: null, price: 1000, sourceUrl: '', storeCode: 'SIGMA' }],
        topReasons: [],
      },
      {
        status: 'COMPATIBLE_WITH_WARNINGS',
        products: [{ productId: 'w1', name: 'W1', thumbnailUrl: null, price: 2000, sourceUrl: '', storeCode: 'SIGMA' }],
        topReasons: ['First reason', 'Second reason'],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups);

    expect(vm.groups[0]!.topReasons).toEqual([]);
    expect(vm.groups[1]!.topReasons).toEqual(['First reason', 'Second reason']);
  });

  it('preserves backward compatibility with existing 3-group responses', () => {
    const groups: CandidateCompatibilityGroupDto[] = [
      {
        status: 'UNKNOWN',
        products: [
          { productId: 'p1', name: 'CPU', thumbnailUrl: null, price: 1000, sourceUrl: '', storeCode: 'SIGMA' },
        ],
        topReasons: [],
      },
    ];

    const vm = mapCandidatesToSelectionViewModel(SLOT_KEY, groups);

    expect(vm.slotDisplayName).toBe('CPU');
    expect(vm.candidates).toHaveLength(1);
    expect(vm.groups).toHaveLength(1);
    expect(vm.groups[0]!.statusLabel).toBe('Unknown Compatibility');
  });
});
