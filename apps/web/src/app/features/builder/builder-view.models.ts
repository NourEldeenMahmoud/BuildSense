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

import type {
  BuildDto,
  BuildItemDto,
  CompatibilityStatus,
} from '@buildsense/contracts';

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
  readonly compatibilityStatus?: CompatibilityStatus;
  readonly compatibilityStatusLabel?: string;
  readonly triggeredRuleIds?: readonly string[];
  readonly topReasons?: readonly string[];
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

// ---------------------------------------------------------------------------
// BuildDto → View Model mapping
// ---------------------------------------------------------------------------

/** Format a number as an EGP price label. Returns "—" for null prices. */
function formatPriceLabel(price: number | null): string {
  if (price === null || price === undefined) {
    return '\u2014';
  }
  return `${price.toLocaleString('en-US')} EGP`;
}

/**
 * Map a single BuildItemDto to a display-only product view model.
 * Preserves truthful null/unknown states — never fabricates values.
 */
function mapItemToProduct(item: BuildItemDto): BuilderSlotProductViewModel {
  return {
    name: item.productName,
    priceLabel: formatPriceLabel(item.totalPrice),
    availabilityLabel: item.storeCode,
  };
}

/**
 * Map a CompatibilityStatus to a human-readable label.
 * UNKNOWN stays unknown — never presented as "Compatible" or "Pass".
 */
function compatibilityStatusLabel(status: CompatibilityStatus): string {
  switch (status) {
    case 'COMPATIBLE':
      return 'Compatible';
    case 'INCOMPATIBLE':
      return 'Incompatible';
    case 'WARNING':
      return 'Warning';
    case 'UNKNOWN':
      return 'Unknown';
    default:
      return 'Unknown';
  }
}

/**
 * Map a BuildDto to seven slot view models.
 *
 * - Items present in the build populate `selectedProduct`.
 * - Empty slots have `selectedProduct: null`.
 * - Slot order matches BUILDER_SLOT_ORDER exactly.
 * - No Cooler or Case Fans slots.
 */
export function mapBuildToSlotViewModels(build: BuildDto): readonly BuilderSlotViewModel[] {
  // Index items by slot for O(1) lookup
  const itemsBySlot = new Map<string, BuildItemDto>();
  for (const item of build.items) {
    itemsBySlot.set(item.slot, item);
  }
  const compatibilityBySlot = new Map(
    build.compatibility.slots.map((result) => [result.slot, result] as const),
  );

  return BUILDER_SLOT_ORDER.map((key, index) => {
    const item = itemsBySlot.get(key);
    const compatibility = compatibilityBySlot.get(key);
    return {
      key,
      displayName: SLOT_DISPLAY_NAMES[key],
      ordinal: index + 1,
      selectedProduct: item ? mapItemToProduct(item) : null,
      compatibilityStatus: compatibility?.status ?? 'UNKNOWN',
      compatibilityStatusLabel: compatibilityStatusLabel(compatibility?.status ?? 'UNKNOWN'),
      triggeredRuleIds: compatibility?.triggeredRuleIds ?? [],
      topReasons: compatibility?.topReasons ?? [],
    };
  });
}

/**
 * Map a BuildDto to the summary view model.
 *
 * Filled count = number of distinct slots with at least one item.
 * Total estimate = pre-formatted pricing label from the API.
 * Compatibility status = pre-formatted from the overall status.
 */
export function mapBuildToSummaryViewModel(build: BuildDto): BuilderSummaryViewModel {
  // Count distinct slots that have items
  const filledSlots = new Set<string>();
  for (const item of build.items) {
    filledSlots.add(item.slot);
  }

  return {
    slotCount: BUILDER_SLOT_ORDER.length,
    filledCount: filledSlots.size,
    totalEstimateLabel: formatPriceLabel(build.pricing.totalPrice),
    compatibilityStatusLabel: compatibilityStatusLabel(build.compatibility.overallStatus),
  };
}
