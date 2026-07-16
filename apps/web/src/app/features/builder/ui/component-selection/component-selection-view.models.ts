/**
 * View models for the component selection presentation.
 *
 * Input-driven: all display values are supplied by the wrapper.
 * No active filtering, no API calls, no persistence, no selection logic.
 * Search and filter are display-only UI shells — inputs exist for visual
 * composition but emit no functional intent in the current milestone.
 */

import type { CandidateCompatibilityGroup, CandidateCompatibilityGroupDto, CandidateProductDto } from '@buildsense/contracts';
import { SLOT_DISPLAY_NAMES, type BuilderSlotKey } from '../../builder-view.models';

/** A candidate product displayed in the selection list. */
export interface SelectionCandidateViewModel {
  readonly id: string;
  readonly name: string;
  readonly brand: string;
  /** Pre-formatted price label (e.g. "25,000 EGP"). */
  readonly priceLabel: string;
  /** Pre-formatted availability label (e.g. "In Stock"). */
  readonly availabilityLabel: string;
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
  /** Pre-built list of candidates — no live search/filter logic. */
  readonly candidates: readonly SelectionCandidateViewModel[];
  /** Groups by compatibility status. */
  readonly groups: readonly SelectionGroupViewModel[];
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

/** Map a CandidateProductDto to a display-only candidate view model. */
function mapCandidateToViewModel(product: CandidateProductDto): SelectionCandidateViewModel {
  return {
    id: product.productId,
    name: product.name,
    brand: product.storeCode,
    priceLabel: formatPriceLabel(product.price),
    availabilityLabel: product.storeCode,
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
): ComponentSelectionViewModel {
  const allCandidates: SelectionCandidateViewModel[] = [];
  const groupVMs: SelectionGroupViewModel[] = [];

  for (const group of groups) {
    const candidates = group.products.map(mapCandidateToViewModel);
    allCandidates.push(...candidates);
    groupVMs.push({
      status: group.status,
      statusLabel: statusLabel(group.status),
      topReasons: group.topReasons,
      candidates,
    });
  }

  return {
    slotDisplayName: SLOT_DISPLAY_NAMES[slotKey],
    candidates: allCandidates,
    groups: groupVMs,
  };
}
