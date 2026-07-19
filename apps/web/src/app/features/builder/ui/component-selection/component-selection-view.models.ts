/**
 * View models for the component selection presentation.
 *
 * Input-driven: all display values are supplied by the wrapper.
 * No active filtering, no API calls, no persistence, no selection logic.
 */

import type {
  CandidateCompatibilityGroup,
  CandidateCompatibilityGroupDto,
  CandidateProductDto,
  CandidateOfferDto,
} from '@buildsense/contracts';
import { getStoreLabel, type StoreCode } from '@buildsense/contracts';
import { SLOT_DISPLAY_NAMES, type BuilderSlotKey } from '../../builder-view.models';

/** Human-readable availability label. */
function availabilityLabel(availability: string): string {
  switch (availability) {
    case 'IN_STOCK':
      return 'In Stock';
    case 'OUT_OF_STOCK':
      return 'Out of Stock';
    default:
      return 'Availability Unknown';
  }
}

/** A single store offer displayed in the candidate card. */
export interface SelectionOfferViewModel {
  readonly storeLabel: string;
  readonly priceLabel: string;
  readonly availabilityLabel: string;
  readonly sourceUrl: string;
}

/** A candidate product displayed in the selection list. */
export interface SelectionCandidateViewModel {
  readonly id: string;
  readonly name: string;
  readonly brand: string;
  readonly model: string;
  /** Best offer price label (e.g. "25,000 EGP"). */
  readonly priceLabel: string;
  /** Best offer availability label. */
  readonly availabilityLabel: string;
  /** Best offer store label (e.g. "Sigma Computer"). */
  readonly storeLabel: string;
  /** Best offer source URL. */
  readonly sourceUrl: string;
  /** All valid offers for this product. */
  readonly offers: readonly SelectionOfferViewModel[];
}

/** A compatibility group displayed in the selection drawer. */
export interface SelectionGroupViewModel {
  readonly status: CandidateCompatibilityGroup;
  readonly statusLabel: string;
  readonly topReasons: readonly string[];
  readonly candidates: readonly SelectionCandidateViewModel[];
}

/** The selection drawer/list view model. */
export interface ComponentSelectionViewModel {
  /** The slot being filled (display label, e.g. "CPU"). */
  readonly slotDisplayName: string;
  /** API-reported total item count across all pages. */
  readonly totalItems: number;
  /** Groups by compatibility status. */
  readonly groups: readonly SelectionGroupViewModel[];
  /** Current page number (1-based). */
  readonly page: number;
  /** Total pages available. */
  readonly totalPages: number;
  /** Whether more pages are available. */
  readonly hasNextPage: boolean;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/** Format a number as an EGP price label. Returns "—" for null prices. */
function formatPriceLabel(price: number | null): string {
  if (price === null || price === undefined) {
    return '\u2014';
  }
  return `${price.toLocaleString('en-US')} EGP`;
}

/** Map a CandidateOfferDto to a display-only offer view model. */
function mapOfferToViewModel(offer: CandidateOfferDto): SelectionOfferViewModel {
  return {
    storeLabel: getStoreLabel(offer.storeCode as StoreCode),
    priceLabel: formatPriceLabel(offer.price),
    availabilityLabel: availabilityLabel(offer.availability),
    sourceUrl: offer.sourceUrl,
  };
}

/** Map a CandidateProductDto to a display-only candidate view model. */
function mapCandidateToViewModel(product: CandidateProductDto): SelectionCandidateViewModel {
  const bestOffer: SelectionOfferViewModel = {
    storeLabel: getStoreLabel(product.storeCode as StoreCode),
    priceLabel: formatPriceLabel(product.price),
    availabilityLabel: availabilityLabel(product.availability),
    sourceUrl: product.sourceUrl,
  };
  const additionalOffers = product.offers.map(mapOfferToViewModel);

  return {
    id: product.productId,
    name: product.name,
    brand: product.brand ?? '',
    model: product.model ?? '',
    priceLabel: bestOffer.priceLabel,
    availabilityLabel: bestOffer.availabilityLabel,
    storeLabel: bestOffer.storeLabel,
    sourceUrl: bestOffer.sourceUrl,
    offers: additionalOffers,
  };
}

/** Map a compatibility status to a human-readable label. */
function statusLabel(status: CandidateCompatibilityGroup): string {
  switch (status) {
    case 'COMPATIBLE':
      return 'Compatible';
    case 'COMPATIBLE_WITH_WARNINGS':
      return 'Compatible with Warnings';
    case 'INCOMPATIBLE':
      return 'Incompatible';
    case 'UNKNOWN':
      return 'Unknown Compatibility';
  }
}

/**
 * Map API candidate groups to the selection view model.
 * Flattens all products into a single list for backward compatibility
 * while also providing grouped display.
 */
export function mapCandidatesToSelectionViewModel(
  slotKey: BuilderSlotKey,
  groups: readonly CandidateCompatibilityGroupDto[],
  totalItems: number,
  page: number,
  totalPages: number,
): ComponentSelectionViewModel {
  const groupVMs: SelectionGroupViewModel[] = [];

  for (const group of groups) {
    const candidates = group.products.map(mapCandidateToViewModel);
    groupVMs.push({
      status: group.status,
      statusLabel: statusLabel(group.status),
      topReasons: group.topReasons,
      candidates,
    });
  }

  return {
    slotDisplayName: SLOT_DISPLAY_NAMES[slotKey],
    totalItems,
    groups: groupVMs,
    page,
    totalPages,
    hasNextPage: page < totalPages,
  };
}
