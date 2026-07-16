import type { SpecEntry } from '../types.js';

/** NZXT H7 Flow — ATX/Micro-ATX/Mini-ITX, 360mm GPU, 7 slots */
export const NZXT_H7_FLOW: readonly SpecEntry[] = [
  { label: 'Motherboard Support', value: 'ATX, Micro-ATX, Mini-ITX' },
  { label: 'Max GPU Length', value: '360 mm' },
  { label: 'Expansion Slots', value: '7' },
];

/** Fractal Design Meshify C — ATX/Micro-ATX/Mini-ITX, 315mm GPU, 7 slots */
export const MESHIFY_C: readonly SpecEntry[] = [
  { label: 'Motherboard Support', value: 'ATX / Micro-ATX / Mini-ITX' },
  { label: 'GPU Clearance', value: '315mm' },
  { label: 'PCIe Slots', value: '7' },
];

/** Empty case specs */
export const EMPTY_CASE: readonly SpecEntry[] = [];

/** Case with only E-ATX support */
export const EATX_ONLY_CASE: readonly SpecEntry[] = [
  { label: 'Supported Form Factors', value: 'E-ATX, ATX' },
  { label: 'Max Graphics Card Length', value: '400 mm' },
  { label: 'Expansion Slots', value: '8' },
];

/** Case with conflicting GPU length labels */
export const CONFLICT_LENGTH_CASE: readonly SpecEntry[] = [
  { label: 'Motherboard Support', value: 'ATX' },
  { label: 'Max GPU Length', value: '360 mm' },
  { label: 'GPU Clearance', value: '330mm' },
  { label: 'Expansion Slots', value: '7' },
];
