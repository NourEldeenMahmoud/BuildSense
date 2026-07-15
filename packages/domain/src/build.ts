/** The seven PC builder slots. */
export type BuildSlot = 'cpu' | 'motherboard' | 'ram' | 'gpu' | 'storage' | 'psu' | 'case';

/** Quantity constraints for a build slot. */
export interface SlotQuantityConstraints {
  readonly min: number;
  readonly max: number;
}

/** Maps each build slot to its quantity constraints. */
export const SLOT_QUANTITY_CONSTRAINTS: Record<BuildSlot, SlotQuantityConstraints> = {
  cpu: { min: 1, max: 1 },
  motherboard: { min: 1, max: 1 },
  ram: { min: 1, max: 4 },
  gpu: { min: 1, max: 1 },
  storage: { min: 1, max: 8 },
  psu: { min: 1, max: 1 },
  case: { min: 1, max: 1 },
};

/** All seven slot names in display order. */
export const BUILD_SLOTS: readonly BuildSlot[] = [
  'cpu',
  'motherboard',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case',
];

/** Per-slot compatibility evaluation status. */
export type CompatibilitySlotStatus =
  | 'UNKNOWN'
  | 'COMPATIBLE'
  | 'INCOMPATIBLE'
  | 'WARNING';

/** Overall build compatibility status. */
export type BuildCompatibilityStatus =
  | 'UNKNOWN'
  | 'COMPATIBLE'
  | 'INCOMPATIBLE'
  | 'WARNING';

/**
 * Build eligibility for the PC builder.
 * Bundles are NOT_ELIGIBLE and never appear as candidates.
 */
export type BuildEligibility = 'ELIGIBLE' | 'NOT_ELIGIBLE';
