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

// ---------------------------------------------------------------------------
// Regression fixtures — live Atlas trace bugs
// ---------------------------------------------------------------------------

/** Live GPU: product/GPU-name field must NOT be misread as length. */
export const LIVE_MODEL_NUMBER_GPU: readonly SpecEntry[] = [
  { label: 'GPU', value: 'AMD Radeon RX 6900 XT' },
  { label: 'Length', value: '267 mm' },
  { label: 'Slot Width', value: '2.5' },
  { label: 'Power Connectors', value: '2 × PCI-E 8-Pin' },
];

/** Live GPU: Unicode × in connector text must be parsed as count 2. */
export const LIVE_UNICODE_CONNECTOR_GPU: readonly SpecEntry[] = [
  { label: 'Length', value: '280 mm' },
  { label: 'Slot Width', value: '2' },
  { label: 'Power Connectors', value: '2 × PCI-E 8-Pin' },
];

/** Live GPU: no board power field in source data — must remain null. */
export const LIVE_NO_BOARD_POWER_GPU: readonly SpecEntry[] = [
  { label: 'Length', value: '267 mm' },
  { label: 'Slot Width', value: '2.5' },
  { label: 'Power Connectors', value: '2x 8-pin' },
];

// ---------------------------------------------------------------------------
// Regression: live Sigma label mismatch (v1.2)
// ---------------------------------------------------------------------------

/**
 * Live GPU: Sigma uses singular "Power Connector" (no trailing 's') while the
 * extractor's canonical label is "Power Connectors" (plural). An alias now
 * bridges the gap.  Product: MSI RTX 5070 Shadow 2X (6a5a156d9c65e58ed0ee2075).
 */
export const LIVE_SIGMA_SINGULAR_CONNECTOR_LABEL: readonly SpecEntry[] = [
  { label: 'Length', value: '231 mm' },
  { label: 'Slot Width', value: '2.5' },
  { label: 'Power Connector', value: '2 × PCI-E 8-Pin' },
];
