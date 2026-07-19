/**
 * Fixture data for the filled Builder presentation.
 *
 * Stage 7 Checkpoint 2 — visual-only fixtures.
 * Product names are display-only labels used solely to demonstrate
 * filled visual slots. Prices and availability are placeholders (— / Unavailable)
 * because no real product data exists at this milestone. Totals and
 * compatibility status are null (not available). No compatibility claims,
 * no best/savings/freshness claims, no persistence, no API calls.
 * These types are frontend-local to the visual subtree and must never
 * be imported by production code or production route entry points.
 */

import type {
  BuilderSlotViewModel,
  BuilderSummaryViewModel,
  BuilderPageViewModel,
} from '../../app/features/builder/builder-view.models';

/** Fixture product display labels for each of the eight slots. */
export const FIXTURE_BUILDER_SLOTS: readonly BuilderSlotViewModel[] = [
  {
    key: 'cpu',
    displayName: 'CPU',
    ordinal: 1,
    selectedProduct: {
      name: 'AMD Ryzen 7 7800X3D Processor',
      priceLabel: '—',
      availabilityLabel: 'Unavailable',
    },
  },
  {
    key: 'motherboard',
    displayName: 'Motherboard',
    ordinal: 2,
    selectedProduct: {
      name: 'MSI MAG B650 TOMAHAWK WIFI',
      priceLabel: '—',
      availabilityLabel: 'Unavailable',
    },
  },
  {
    key: 'ram',
    displayName: 'RAM',
    ordinal: 3,
    selectedProduct: {
      name: 'Corsair Vengeance DDR5 32GB',
      priceLabel: '—',
      availabilityLabel: 'Unavailable',
    },
  },
  {
    key: 'gpu',
    displayName: 'GPU',
    ordinal: 4,
    selectedProduct: {
      name: 'NVIDIA GeForce RTX 4070 SUPER',
      priceLabel: '—',
      availabilityLabel: 'Unavailable',
    },
  },
  {
    key: 'storage',
    displayName: 'Storage',
    ordinal: 5,
    selectedProduct: {
      name: 'Samsung 990 PRO 2TB NVMe SSD',
      priceLabel: '—',
      availabilityLabel: 'Unavailable',
    },
  },
  {
    key: 'psu',
    displayName: 'PSU',
    ordinal: 6,
    selectedProduct: {
      name: 'Corsair RM850x 850W 80+ Gold',
      priceLabel: '—',
      availabilityLabel: 'Unavailable',
    },
  },
  {
    key: 'case',
    displayName: 'Case',
    ordinal: 7,
    selectedProduct: {
      name: 'NZXT H7 Flow RGB',
      priceLabel: '—',
      availabilityLabel: 'Unavailable',
    },
  },
  {
    key: 'cooling',
    displayName: 'Cooling',
    ordinal: 8,
    selectedProduct: {
      name: 'Noctua NH-D15 chromax.black',
      priceLabel: '—',
      availabilityLabel: 'Unavailable',
    },
  },
];

/** Fixture summary — totals and compatibility are null (not available). */
export const FIXTURE_BUILDER_SUMMARY: BuilderSummaryViewModel = {
  slotCount: 8,
  filledCount: 8,
  totalEstimateLabel: null,
  compatibilityStatusLabel: null,
};

/** Complete filled builder page view model. */
export const FIXTURE_BUILDER_PAGE_VM: BuilderPageViewModel = {
  slots: FIXTURE_BUILDER_SLOTS,
  summary: FIXTURE_BUILDER_SUMMARY,
};
