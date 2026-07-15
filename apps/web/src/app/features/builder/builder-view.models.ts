/**
 * Production-safe immutable view models for Builder presentation.
 *
 * These types are frontend-local and do NOT transport database models,
 * API DTOs, or fixture data. They represent the truthful empty/deferred
 * state of the Builder in the current milestone.
 *
 * Stage 7 Checkpoint 2 — supports both empty (production) and filled
 * (visual fixture) presentation via input-driven view models. Components
 * never fabricate values; they display exactly what the wrapper supplies.
 */

/** The canonical seven component slots in display order. */
export const BUILDER_SLOT_ORDER = [
  'cpu',
  'motherboard',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case',
] as const;

export type BuilderSlotKey = (typeof BUILDER_SLOT_ORDER)[number];

/** Human-readable display name for each slot. */
export const SLOT_DISPLAY_NAMES: Record<BuilderSlotKey, string> = {
  cpu: 'CPU',
  motherboard: 'Motherboard',
  ram: 'RAM',
  gpu: 'GPU',
  storage: 'Storage',
  psu: 'PSU',
  case: 'Case',
};

/** Display-only product information for a filled slot. */
export interface BuilderSlotProductViewModel {
  readonly name: string;
  /** Pre-formatted price label supplied by the wrapper (e.g. "25,000 EGP"). */
  readonly priceLabel: string;
  /** Pre-formatted availability label (e.g. "In Stock"). */
  readonly availabilityLabel: string;
}

/** An immutable view model for a single builder slot. */
export interface BuilderSlotViewModel {
  readonly key: BuilderSlotKey;
  readonly displayName: string;
  readonly ordinal: number;
  /** null = empty slot; object = filled slot with display-only product data. */
  readonly selectedProduct: BuilderSlotProductViewModel | null;
}

/** Build the immutable empty slot view models. */
export function createEmptySlotViewModels(): readonly BuilderSlotViewModel[] {
  return BUILDER_SLOT_ORDER.map((key, index) => ({
    key,
    displayName: SLOT_DISPLAY_NAMES[key],
    ordinal: index + 1,
    selectedProduct: null,
  }));
}

/** Aggregate summary view model — supports empty and filled display. */
export interface BuilderSummaryViewModel {
  readonly slotCount: number;
  readonly filledCount: number;
  /** null = not available; string = pre-formatted label supplied by wrapper. */
  readonly totalEstimateLabel: string | null;
  /** null = deferred; string = pre-formatted label supplied by wrapper. */
  readonly compatibilityStatusLabel: string | null;
}

/** Builder page-level view model. */
export interface BuilderPageViewModel {
  readonly slots: readonly BuilderSlotViewModel[];
  readonly summary: BuilderSummaryViewModel;
}

/** Create the production builder page view model — truthful empty state. */
export function createBuilderPageViewModel(): BuilderPageViewModel {
  const slots = createEmptySlotViewModels();
  return {
    slots,
    summary: {
      slotCount: slots.length,
      filledCount: 0,
      totalEstimateLabel: null,
      compatibilityStatusLabel: null,
    },
  };
}

/** UI intents the builder workspace may emit (no persistence or API calls). */
export type BuilderUiIntent =
  | { readonly type: 'navigate-catalog' }
  | { readonly type: 'select-slot'; readonly slotKey: BuilderSlotKey };
