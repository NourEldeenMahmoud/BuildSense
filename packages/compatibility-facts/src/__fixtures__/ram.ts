import type { SpecEntry } from '../types.js';

/** Corsair Vengeance DDR5-5600 32GB (2x16GB) DIMM */
export const DDR5_5600_32GB: readonly SpecEntry[] = [
  { label: 'Memory Type', value: 'DDR5' },
  { label: 'Form Factor', value: '288-pin DIMM' },
  { label: 'Modules', value: '2 x 16GB' },
  { label: 'Capacity', value: '32 GB' },
  { label: 'Speed', value: 'DDR5-5600' },
];

/** G.Skill Ripjaws DDR4-3200 16GB (2x8GB) DIMM */
export const DDR4_3200_16GB: readonly SpecEntry[] = [
  { label: 'Memory Type', value: 'DDR4' },
  { label: 'Form Factor', value: 'DIMM' },
  { label: 'Modules', value: '2' },
  { label: 'Kit Capacity', value: '16 GB' },
  { label: 'Speed', value: '3200 MHz' },
];

/** Kingston SO-DIMM DDR5-4800 16GB (1x16GB) */
export const DDR5_SODIMM_16GB: readonly SpecEntry[] = [
  { label: 'Memory Type', value: 'DDR5' },
  { label: 'Form Factor', value: 'SO-DIMM' },
  { label: 'Modules', value: '1' },
  { label: 'Capacity', value: '16GB' },
  { label: 'Speed', value: '4800 MHz' },
];

/** Empty RAM specs */
export const EMPTY_RAM: readonly SpecEntry[] = [];

/** RAM with speed in format "DDR5-6000" */
export const DDR5_6000_64GB: readonly SpecEntry[] = [
  { label: 'RAM Type', value: 'DDR5' },
  { label: 'Module Type', value: 'DIMM' },
  { label: 'Modules', value: '2' },
  { label: 'Capacity', value: '64 GB' },
  { label: 'Speed', value: 'DDR5-6000' },
];

/** RAM with conflicting speed labels */
export const CONFLICT_SPEED_RAM: readonly SpecEntry[] = [
  { label: 'Memory Type', value: 'DDR5' },
  { label: 'Form Factor', value: 'DIMM' },
  { label: 'Modules', value: '2' },
  { label: 'Capacity', value: '32 GB' },
  { label: 'Speed', value: '5600 MHz' },
  { label: 'Rated Speed', value: '6000 MHz' },
];

/** RAM with empty capacity */
export const EMPTY_CAPACITY_RAM: readonly SpecEntry[] = [
  { label: 'Memory Type', value: 'DDR4' },
  { label: 'Form Factor', value: 'DIMM' },
  { label: 'Modules', value: '2' },
  { label: 'Capacity', value: '' },
  { label: 'Speed', value: '3200 MHz' },
];
