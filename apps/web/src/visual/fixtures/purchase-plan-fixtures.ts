/**
 * Fixture data for the Purchase Plan / Build Review presentation.
 *
 * Stage 7 Checkpoint 2 — visual-only fixtures.
 * Product names are display-only labels used solely to demonstrate
 * filled visual slots. Prices and availability are placeholders (— / Unavailable)
 * because no real product data exists at this milestone. Totals and
 * compatibility status are null (not available). No compatibility claims,
 * no best/savings/freshness claims, no persistence, no API calls, and no checkout.
 */

import type {
  PurchasePlanPageViewModel,
  PurchasePlanComponentRowViewModel,
} from '../../app/features/purchase-plan/purchase-plan-view.models';

/** Fixture component rows for visual validation. */
export const FIXTURE_PURCHASE_ROWS: readonly PurchasePlanComponentRowViewModel[] = [
  {
    slotKey: 'cpu',
    slotDisplayName: 'CPU',
    productId: 'fixture-cpu',
    productName: 'AMD Ryzen 7 7800X3D Processor',
    imageUrl: null,
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    compatibilityStatus: 'UNKNOWN',
    compatibilityStatusLabel: 'Unknown',
    compatibilityReason: null,
    sourceUrl: '',
  },
  {
    slotKey: 'motherboard',
    slotDisplayName: 'Motherboard',
    productId: 'fixture-motherboard',
    productName: 'MSI MAG B650 TOMAHAWK WIFI',
    imageUrl: null,
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    compatibilityStatus: 'UNKNOWN',
    compatibilityStatusLabel: 'Unknown',
    compatibilityReason: null,
    sourceUrl: '',
  },
  {
    slotKey: 'ram',
    slotDisplayName: 'RAM',
    productId: 'fixture-ram',
    productName: 'Corsair Vengeance DDR5 32GB',
    imageUrl: null,
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    compatibilityStatus: 'UNKNOWN',
    compatibilityStatusLabel: 'Unknown',
    compatibilityReason: null,
    sourceUrl: '',
  },
  {
    slotKey: 'gpu',
    slotDisplayName: 'GPU',
    productId: 'fixture-gpu',
    productName: 'NVIDIA GeForce RTX 4070 SUPER',
    imageUrl: null,
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    compatibilityStatus: 'UNKNOWN',
    compatibilityStatusLabel: 'Unknown',
    compatibilityReason: null,
    sourceUrl: '',
  },
  {
    slotKey: 'storage',
    slotDisplayName: 'Storage',
    productId: 'fixture-storage',
    productName: 'Samsung 990 PRO 2TB NVMe SSD',
    imageUrl: null,
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    compatibilityStatus: 'UNKNOWN',
    compatibilityStatusLabel: 'Unknown',
    compatibilityReason: null,
    sourceUrl: '',
  },
  {
    slotKey: 'psu',
    slotDisplayName: 'PSU',
    productId: 'fixture-psu',
    productName: 'Corsair RM850x 850W 80+ Gold',
    imageUrl: null,
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    compatibilityStatus: 'UNKNOWN',
    compatibilityStatusLabel: 'Unknown',
    compatibilityReason: null,
    sourceUrl: '',
  },
  {
    slotKey: 'case',
    slotDisplayName: 'Case',
    productId: 'fixture-case',
    productName: 'NZXT H7 Flow RGB',
    imageUrl: null,
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    compatibilityStatus: 'UNKNOWN',
    compatibilityStatusLabel: 'Unknown',
    compatibilityReason: null,
    sourceUrl: '',
  },
  {
    slotKey: 'cooling',
    slotDisplayName: 'Cooling',
    productId: 'fixture-cooling',
    productName: 'Noctua NH-D15 chromax.black',
    imageUrl: null,
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    compatibilityStatus: 'UNKNOWN',
    compatibilityStatusLabel: 'Unknown',
    compatibilityReason: null,
    sourceUrl: '',
  },
];

/** Fixture purchase plan page view model. */
export const FIXTURE_PURCHASE_PLAN_VM: PurchasePlanPageViewModel = {
  hasBuild: true,
  buildPublicId: 'visual-build',
  buildStatusLabel: 'Build synced · Version 1',
  componentCount: 8,
  componentTarget: 8,
  productsScannedLabel: null,
  totalPriceLabel: null,
  compatibilityStatusLabel: null,
  compatibilityStatus: 'UNKNOWN',
  compatibilityHeading: 'Compatibility not fully known',
  compatibilityDescription: 'Compatibility data is unavailable for this visual fixture.',
  componentRows: FIXTURE_PURCHASE_ROWS,
};
