/**
 * Production-safe immutable view models for Purchase Plan presentation.
 *
 * Stage 7 Checkpoint 2 — supports both empty (production) and filled
 * (visual fixture) presentation via input-driven view models.
 * Components never fabricate values; they display exactly what the wrapper supplies.
 * No fixture products, prices, availability, totals, export, or compatibility.
 */

/** A single component row in the purchase review. */
export interface PurchasePlanComponentRowViewModel {
  readonly slotDisplayName: string;
  readonly productName: string;
  /** Pre-formatted price label (e.g. "25,000 EGP"). */
  readonly priceLabel: string;
  /** Pre-formatted availability label (e.g. "In Stock"). */
  readonly availabilityLabel: string;
  /** Source URL for the retailer link. Empty string = no link. */
  readonly sourceUrl: string;
}

/** Purchase plan page view model — supports empty and filled display. */
export interface PurchasePlanPageViewModel {
  readonly hasBuild: boolean;
  readonly componentCount: number;
  /** null = not available; string = pre-formatted label supplied by wrapper. */
  readonly totalPriceLabel: string | null;
  /** null = not available; string = pre-formatted label supplied by wrapper. */
  readonly compatibilityStatusLabel: string | null;
  /** Only present when hasBuild is true; empty array in empty state. */
  readonly componentRows: readonly PurchasePlanComponentRowViewModel[];
}

/** Create the production purchase plan view model — honest empty state. */
export function createPurchasePlanPageViewModel(): PurchasePlanPageViewModel {
  return {
    hasBuild: false,
    componentCount: 0,
    totalPriceLabel: null,
    compatibilityStatusLabel: null,
    componentRows: [],
  };
}

/** UI intents emitted by the purchase plan page. */
export type PurchasePlanUiIntent =
  | { readonly type: 'navigate-builder' }
  | { readonly type: 'navigate-catalog' };
