/**
 * View models for the component selection presentation.
 *
 * Input-driven: all display values are supplied by the wrapper.
 * No active filtering, no API calls, no persistence, no selection logic.
 * Search and filter are display-only UI shells — inputs exist for visual
 * composition but emit no functional intent in the current milestone.
 */

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

/** The selection drawer/list view model. */
export interface ComponentSelectionViewModel {
  /** The slot being filled (display label, e.g. "CPU"). */
  readonly slotDisplayName: string;
  /** Pre-built list of candidates — no live search/filter logic. */
  readonly candidates: readonly SelectionCandidateViewModel[];
}
