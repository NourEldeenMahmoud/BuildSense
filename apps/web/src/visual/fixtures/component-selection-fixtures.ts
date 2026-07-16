/**
 * Fixture data for the Component Selection presentation.
 *
 * Stage 7 Checkpoint 2 — visual-only fixtures.
 * Product names and brands are display-only labels used solely to demonstrate
 * filled visual slots. Prices and availability are placeholders (— / Unavailable)
 * because no real product data exists at this milestone. No active selection
 * behavior, no filtering logic, no API calls, no persistence.
 */

import type { ComponentSelectionViewModel } from '../../app/features/builder/ui/component-selection/component-selection-view.models';

const CPU_FIXTURE_CANDIDATES = [
  {
    id: 'fixture-cpu-001',
    name: 'AMD Ryzen 7 7800X3D Processor',
    brand: 'AMD',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
  },
  {
    id: 'fixture-cpu-002',
    name: 'Intel Core i7-14700K Processor',
    brand: 'Intel',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
  },
  {
    id: 'fixture-cpu-003',
    name: 'AMD Ryzen 5 7600X Processor',
    brand: 'AMD',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
  },
  {
    id: 'fixture-cpu-004',
    name: 'Intel Core i5-14600K Processor',
    brand: 'Intel',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
  },
  {
    id: 'fixture-cpu-005',
    name: 'AMD Ryzen 9 7950X Processor',
    brand: 'AMD',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
  },
];

/** Fixture CPU selection candidates for visual validation. */
export const FIXTURE_SELECTION_CPU: ComponentSelectionViewModel = {
  slotDisplayName: 'CPU',
  candidates: CPU_FIXTURE_CANDIDATES,
  groups: [
    {
      status: 'UNKNOWN',
      statusLabel: 'Unknown Compatibility',
      topReasons: [],
      candidates: CPU_FIXTURE_CANDIDATES,
    },
  ],
};
