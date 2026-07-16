import type { SpecEntry } from '../types.js';

/** AMD Ryzen 7 7700X — AM5, no iGPU, 170W TDP */
export const RYZEN_7700X: readonly SpecEntry[] = [
  { label: 'Socket', value: 'Socket AM5' },
  { label: 'Family', value: 'AMD Ryzen 7' },
  { label: 'Integrated Graphics', value: 'No' },
  { label: 'TDP', value: '170W' },
];

/** Intel Core i7-13700K — LGA1700, has iGPU, 125W TDP */
export const I7_13700K: readonly SpecEntry[] = [
  { label: 'CPU Socket', value: 'LGA 1700' },
  { label: 'Series', value: 'Intel Core i7' },
  { label: 'Integrated Graphics', value: 'Intel UHD 770' },
  { label: 'TDP (W)', value: '125' },
];

/** AMD Ryzen 5 5600X — AM4, no iGPU, 65W TDP */
export const RYZEN_5600X: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM4' },
  { label: 'CPU Family', value: 'AMD Ryzen 5' },
  { label: 'Integrated Graphics', value: 'None' },
  { label: 'Power', value: '65 W' },
];

/** Empty CPU specs */
export const EMPTY_CPU: readonly SpecEntry[] = [];

/** CPU with missing socket and TDP */
export const MISSING_SOCKET_CPU: readonly SpecEntry[] = [
  { label: 'Family', value: 'AMD Ryzen 9' },
];

/** CPU with malformed TDP */
export const MALFORMED_TDP_CPU: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM5' },
  { label: 'TDP', value: 'unknown watts' },
];

/** CPU with iGPU present (non-standard value) */
export const IGPU_PRESENT_CPU: readonly SpecEntry[] = [
  { label: 'Socket', value: 'LGA1700' },
  { label: 'Integrated Graphics', value: 'Intel Iris Xe' },
  { label: 'TDP', value: '65W' },
];

/** CPU with empty iGPU value */
export const IGPU_EMPTY_CPU: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM5' },
  { label: 'Integrated Graphics', value: '' },
  { label: 'TDP', value: '65W' },
];

/** CPU with "Unknown" iGPU value — should be null, not true */
export const IGPU_UNKNOWN_CPU: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM5' },
  { label: 'Integrated Graphics', value: 'Unknown' },
  { label: 'TDP', value: '65W' },
];

/** CPU with "N/A" iGPU value — should be false (negative set) */
export const IGPU_NA_CPU: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM4' },
  { label: 'Integrated Graphics', value: 'N/A' },
  { label: 'TDP', value: '105W' },
];

/** CPU with iGPU as Intel UHD 770 — known model name */
export const IGPU_UHD_CPU: readonly SpecEntry[] = [
  { label: 'Socket', value: 'LGA1700' },
  { label: 'Integrated Graphics', value: 'Intel UHD 770' },
  { label: 'TDP', value: '65W' },
];

/** CPU with iGPU as AMD Radeon Graphics — known model name */
export const IGPU_RADEON_CPU: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM5' },
  { label: 'Integrated Graphics', value: 'AMD Radeon Graphics' },
  { label: 'TDP', value: '65W' },
];

/** CPU with ambiguous iGPU value — should be null */
export const IGPU_AMBIGUOUS_CPU: readonly SpecEntry[] = [
  { label: 'Socket', value: 'LGA1700' },
  { label: 'Integrated Graphics', value: 'Shared Memory' },
  { label: 'TDP', value: '65W' },
];

/** CPU with no iGPU label at all — should be null */
export const NO_IGPU_LABEL_CPU: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM5' },
  { label: 'TDP', value: '170W' },
];
