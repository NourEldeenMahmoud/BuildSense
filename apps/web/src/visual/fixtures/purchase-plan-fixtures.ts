/**
 * Fixture data for the Purchase Plan / Build Review presentation.
 *
 * Stage 7 Checkpoint 2 — visual-only fixtures.
 * Product names are display-only labels used solely to demonstrate
 * filled visual slots. Prices and availability are placeholders (— / Unavailable)
 * because no real product data exists at this milestone. Totals and
 * compatibility status are null (not available). No compatibility claims,
 * no best/savings/freshness claims, no persistence, no API calls,
 * no export, no print, no checkout.
 */

import type {
  PurchasePlanPageViewModel,
  PurchasePlanComponentRowViewModel,
} from '../../app/features/purchase-plan/purchase-plan-view.models';

/** Fixture component rows for visual validation. */
export const FIXTURE_PURCHASE_ROWS: readonly PurchasePlanComponentRowViewModel[] = [
  {
    slotDisplayName: 'CPU',
    productName: 'AMD Ryzen 7 7800X3D Processor',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    sourceUrl: '',
  },
  {
    slotDisplayName: 'Motherboard',
    productName: 'MSI MAG B650 TOMAHAWK WIFI',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    sourceUrl: '',
  },
  {
    slotDisplayName: 'RAM',
    productName: 'Corsair Vengeance DDR5 32GB',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    sourceUrl: '',
  },
  {
    slotDisplayName: 'GPU',
    productName: 'NVIDIA GeForce RTX 4070 SUPER',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    sourceUrl: '',
  },
  {
    slotDisplayName: 'Storage',
    productName: 'Samsung 990 PRO 2TB NVMe SSD',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    sourceUrl: '',
  },
  {
    slotDisplayName: 'PSU',
    productName: 'Corsair RM850x 850W 80+ Gold',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    sourceUrl: '',
  },
  {
    slotDisplayName: 'Case',
    productName: 'NZXT H7 Flow RGB',
    priceLabel: '—',
    availabilityLabel: 'Unavailable',
    sourceUrl: '',
  },
];

/** Fixture purchase plan page view model. */
export const FIXTURE_PURCHASE_PLAN_VM: PurchasePlanPageViewModel = {
  hasBuild: true,
  componentCount: 7,
  totalPriceLabel: null,
  compatibilityStatusLabel: null,
  componentRows: FIXTURE_PURCHASE_ROWS,
};
