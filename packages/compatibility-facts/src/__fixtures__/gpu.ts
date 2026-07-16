import type { SpecEntry } from '../types.js';

/** NVIDIA RTX 4070 Ti — 300mm, 2.5 slots, 1x 12VHPWR, 285W */
export const RTX_4070_TI: readonly SpecEntry[] = [
  { label: 'Length', value: '300 mm' },
  { label: 'Slot Width', value: '2.5' },
  { label: 'Power Connectors', value: '1x 12VHPWR' },
  { label: 'Board Power', value: '285W' },
];

/** AMD RX 7800 XT — 267mm, 2 slots, 2x 8-pin, 263W */
export const RX_7800_XT: readonly SpecEntry[] = [
  { label: 'GPU Length', value: '267mm' },
  { label: 'Expansion Slots', value: '2' },
  { label: 'PCIe Power', value: '2x 8-pin' },
  { label: 'TDP', value: '263' },
];

/** NVIDIA RTX 4060 — 240mm, 2 slots, 1x 8-pin, 115W */
export const RTX_4060: readonly SpecEntry[] = [
  { label: 'Length', value: '240 mm' },
  { label: 'Slots', value: '2' },
  { label: 'Power Connectors', value: '1x 8-pin' },
  { label: 'Board Power', value: '115W' },
];

/** Empty GPU specs */
export const EMPTY_GPU: readonly SpecEntry[] = [];

/** GPU with dual connectors */
export const DUAL_CONNECTOR_GPU: readonly SpecEntry[] = [
  { label: 'Card Length', value: '330 mm' },
  { label: 'Slot Width', value: '3' },
  { label: 'Power Input', value: '1x 8-pin + 1x 6-pin' },
  { label: 'Board Power', value: '350 W' },
];

/** GPU with "Recommended PSU" label — should NOT be extracted as boardPower */
export const GPU_RECOMMENDED_PSU_ONLY: readonly SpecEntry[] = [
  { label: 'Length', value: '240 mm' },
  { label: 'Slots', value: '2' },
  { label: 'Power Connectors', value: '1x 8-pin' },
  { label: 'Recommended PSU', value: '550W' },
];

/** GPU with conflicting board power labels */
export const CONFLICT_POWER_GPU: readonly SpecEntry[] = [
  { label: 'Length', value: '300 mm' },
  { label: 'Slot Width', value: '2.5' },
  { label: 'Power Connectors', value: '1x 12VHPWR' },
  { label: 'Board Power', value: '285W' },
  { label: 'TDP', value: '250W' },
];
