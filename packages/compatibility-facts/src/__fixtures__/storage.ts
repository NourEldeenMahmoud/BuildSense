import type { SpecEntry } from '../types.js';

/** Samsung 990 Pro 2TB — NVMe, M.2 2280 */
export const SAMSUNG_990_PRO: readonly SpecEntry[] = [
  { label: 'Interface', value: 'NVMe PCIe 4.0' },
  { label: 'Form Factor', value: 'M.2 2280' },
];

/** Crucial MX500 1TB — SATA, 2.5" */
export const CRUCIAL_MX500: readonly SpecEntry[] = [
  { label: 'Interface', value: 'SATA III' },
  { label: 'Form Factor', value: '2.5 inches' },
];

/** WD Black SN850X 1TB — NVMe, M.2 2280 */
export const WD_BLACK_SN850X: readonly SpecEntry[] = [
  { label: 'Protocol', value: 'NVMe' },
  { label: 'Size', value: 'M.2 2280' },
];

/** Empty storage specs */
export const EMPTY_STORAGE: readonly SpecEntry[] = [];

/** Storage with PCIe interface */
export const PCIE_STORAGE: readonly SpecEntry[] = [
  { label: 'Connection', value: 'PCIe Gen 4' },
  { label: 'Form Factor', value: '3.5"' },
];

/** Storage with conflicting interface labels */
export const CONFLICT_IFACE_STORAGE: readonly SpecEntry[] = [
  { label: 'Interface', value: 'NVMe PCIe 4.0' },
  { label: 'Protocol', value: 'SATA III' },
  { label: 'Form Factor', value: 'M.2 2280' },
];
