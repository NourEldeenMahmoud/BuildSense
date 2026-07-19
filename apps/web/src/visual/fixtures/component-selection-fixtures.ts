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
    model: 'Ryzen 7 7800X3D',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    storeLabel: 'Sigma Computer',
    sourceUrl: 'https://example.com/fixture-cpu-001',
    offers: [
      { storeLabel: 'Sigma Computer', priceLabel: '—', availabilityLabel: 'Unavailable', sourceUrl: 'https://example.com/fixture-cpu-001' },
    ],
  },
  {
    id: 'fixture-cpu-002',
    name: 'Intel Core i7-14700K Processor',
    brand: 'Intel',
    model: 'Core i7-14700K',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    storeLabel: 'Sigma Computer',
    sourceUrl: 'https://example.com/fixture-cpu-002',
    offers: [
      { storeLabel: 'Sigma Computer', priceLabel: '—', availabilityLabel: 'Unavailable', sourceUrl: 'https://example.com/fixture-cpu-002' },
    ],
  },
  {
    id: 'fixture-cpu-003',
    name: 'AMD Ryzen 5 7600X Processor',
    brand: 'AMD',
    model: 'Ryzen 5 7600X',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    storeLabel: 'Sigma Computer',
    sourceUrl: 'https://example.com/fixture-cpu-003',
    offers: [
      { storeLabel: 'Sigma Computer', priceLabel: '—', availabilityLabel: 'Unavailable', sourceUrl: 'https://example.com/fixture-cpu-003' },
    ],
  },
  {
    id: 'fixture-cpu-004',
    name: 'Intel Core i5-14600K Processor',
    brand: 'Intel',
    model: 'Core i5-14600K',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    storeLabel: 'Sigma Computer',
    sourceUrl: 'https://example.com/fixture-cpu-004',
    offers: [
      { storeLabel: 'Sigma Computer', priceLabel: '—', availabilityLabel: 'Unavailable', sourceUrl: 'https://example.com/fixture-cpu-004' },
    ],
  },
  {
    id: 'fixture-cpu-005',
    name: 'AMD Ryzen 9 7950X Processor',
    brand: 'AMD',
    model: 'Ryzen 9 7950X',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    storeLabel: 'Sigma Computer',
    sourceUrl: 'https://example.com/fixture-cpu-005',
    offers: [
      { storeLabel: 'Sigma Computer', priceLabel: '—', availabilityLabel: 'Unavailable', sourceUrl: 'https://example.com/fixture-cpu-005' },
    ],
  },
];

/** Fixture CPU selection candidates for visual validation. */
export const FIXTURE_SELECTION_CPU: ComponentSelectionViewModel = {
  slotDisplayName: 'CPU',
  totalItems: 5,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
  groups: [
    {
      status: 'UNKNOWN',
      statusLabel: 'Unknown Compatibility',
      topReasons: [],
      candidates: CPU_FIXTURE_CANDIDATES,
    },
  ],
};
