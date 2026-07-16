import type { SpecEntry } from '../types.js';

/** Corsair RM850x — 850W */
export const CORSAIR_RM850X: readonly SpecEntry[] = [
  { label: 'Wattage', value: '850W' },
];

/** EVGA SuperNOVA 650 G7 — 650W */
export const EVGA_650_G7: readonly SpecEntry[] = [
  { label: 'Power', value: '650 W' },
];

/** Empty PSU specs */
export const EMPTY_PSU: readonly SpecEntry[] = [];

/** PSU with malformed wattage */
export const MALFORMED_PSU: readonly SpecEntry[] = [
  { label: 'Wattage', value: 'high wattage unit' },
];

/** PSU with conflicting wattage labels */
export const CONFLICT_WATTAGE_PSU: readonly SpecEntry[] = [
  { label: 'Wattage', value: '850W' },
  { label: 'Power', value: '750W' },
];

/** PSU with empty wattage */
export const EMPTY_WATTAGE_PSU: readonly SpecEntry[] = [
  { label: 'Wattage', value: '' },
];
