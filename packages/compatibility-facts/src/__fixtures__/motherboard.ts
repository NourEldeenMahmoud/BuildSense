import type { SpecEntry } from '../types.js';

/** ASUS ROG Strix B650E-F — AM5, ATX, DDR5, 4 slots, 128GB, 6 SATA, 2 M.2 */
export const B650E_F: readonly SpecEntry[] = [
  { label: 'Socket', value: 'Socket AM5' },
  { label: 'Chipset', value: 'B650E' },
  { label: 'Form Factor', value: 'ATX' },
  { label: 'Memory Type', value: 'DDR5' },
  { label: 'Memory Slots', value: '4' },
  { label: 'Max Memory', value: '128 GB' },
  { label: 'Max Memory Speed', value: '5600 MHz' },
  { label: 'SATA Ports', value: '6' },
  { label: 'M.2 Slots', value: '2' },
  { label: 'M.2 Form Factors', value: '2280, 2242' },
];

/** MSI MAG B760M Mortar — LGA1700, Micro-ATX, DDR5, 2 slots, 64GB */
export const B760M_MORTAR: readonly SpecEntry[] = [
  { label: 'Socket', value: 'LGA1700' },
  { label: 'Chipset', value: 'B760' },
  { label: 'Size', value: 'Micro ATX' },
  { label: 'Memory Type', value: 'DDR5 DIMM' },
  { label: 'DIMM Slots', value: '2' },
  { label: 'Max RAM', value: '64' },
  { label: 'Memory Speed', value: '4800 MHz' },
  { label: 'SATA', value: '4' },
  { label: 'M.2', value: '2' },
];

/** Gigabyte B550M DS3H — AM4, Micro-ATX, DDR4, 2 slots, 128GB */
export const B550M_DS3H: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM4' },
  { label: 'Chipset', value: 'B550' },
  { label: 'Form Factor', value: 'mATX' },
  { label: 'Memory Type', value: 'DDR4' },
  { label: 'Memory Slots', value: '2' },
  { label: 'Max Memory', value: '128GB' },
  { label: 'SATA Ports', value: '4' },
  { label: 'M.2 Slots', value: '1' },
];

/** Empty motherboard specs */
export const EMPTY_MB: readonly SpecEntry[] = [];

/** MB with DDR5 SO-DIMM (laptop) */
export const SODIMM_MB: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM5' },
  { label: 'Chipset', value: 'B650' },
  { label: 'Form Factor', value: 'Mini-ITX' },
  { label: 'Memory Type', value: 'DDR5 SO-DIMM' },
  { label: 'Memory Slots', value: '2' },
  { label: 'Max Memory', value: '64 GB' },
  { label: 'SATA Ports', value: '2' },
];

/** MB with duplicate socket labels that disagree — should produce null socket */
export const CONFLICT_SOCKET_MB: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM5' },
  { label: 'CPU Socket', value: 'LGA1700' },
  { label: 'Chipset', value: 'B650' },
  { label: 'Form Factor', value: 'ATX' },
  { label: 'Memory Type', value: 'DDR5' },
  { label: 'Memory Slots', value: '4' },
  { label: 'Max Memory', value: '128 GB' },
  { label: 'SATA Ports', value: '4' },
];

/** MB with duplicate form factor labels that disagree — should produce null formFactor */
export const CONFLICT_FF_MB: readonly SpecEntry[] = [
  { label: 'Socket', value: 'AM5' },
  { label: 'Chipset', value: 'B650' },
  { label: 'Form Factor', value: 'ATX' },
  { label: 'Size', value: 'Mini-ITX' },
  { label: 'Memory Type', value: 'DDR5' },
  { label: 'Memory Slots', value: '2' },
  { label: 'Max Memory', value: '64 GB' },
  { label: 'SATA Ports', value: '2' },
];
