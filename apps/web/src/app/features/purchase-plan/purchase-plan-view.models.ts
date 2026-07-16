/**
 * Production-safe immutable view models for Purchase Plan presentation.
 *
 * Components never fabricate product facts; they display values mapped from
 * the Build and Purchase Plan API responses.
 */

import type {
  BuildDto,
  BuildItemDto,
  CompatibilityStatus,
  PurchasePlanItemDto,
  PurchasePlanDto,
  SlotCompatibilityDto,
} from '@buildsense/contracts';

/** A single component row in the purchase review. */
export interface PurchasePlanComponentRowViewModel {
  readonly slotKey: string;
  readonly slotDisplayName: string;
  readonly productId: string;
  readonly productName: string;
  readonly imageUrl: string | null;
  /** Pre-formatted price label (e.g. "25,000 EGP"). */
  readonly priceLabel: string;
  /** Pre-formatted availability label (e.g. "In Stock"). */
  readonly availabilityLabel: string;
  readonly compatibilityStatus: CompatibilityStatus;
  readonly compatibilityStatusLabel: string;
  readonly compatibilityReason: string | null;
  /** Source URL for the retailer link. Empty string = no link. */
  readonly sourceUrl: string;
}

/** Purchase plan page view model — supports empty and filled display. */
export interface PurchasePlanPageViewModel {
  readonly hasBuild: boolean;
  readonly buildPublicId: string | null;
  readonly buildStatusLabel: string | null;
  readonly componentCount: number;
  readonly componentTarget: number;
  readonly productsScannedLabel: string | null;
  /** null = not available; string = pre-formatted label supplied by wrapper. */
  readonly totalPriceLabel: string | null;
  /** null = not available; string = pre-formatted label supplied by wrapper. */
  readonly compatibilityStatusLabel: string | null;
  readonly compatibilityStatus: CompatibilityStatus | null;
  readonly compatibilityHeading: string | null;
  readonly compatibilityDescription: string | null;
  /** Only present when hasBuild is true; empty array in empty state. */
  readonly componentRows: readonly PurchasePlanComponentRowViewModel[];
}

/** Create the production purchase plan view model — honest empty state. */
export function createPurchasePlanPageViewModel(): PurchasePlanPageViewModel {
  return {
    hasBuild: false,
    buildPublicId: null,
    buildStatusLabel: null,
    componentCount: 0,
    componentTarget: 7,
    productsScannedLabel: null,
    totalPriceLabel: null,
    compatibilityStatusLabel: null,
    compatibilityStatus: null,
    compatibilityHeading: null,
    compatibilityDescription: null,
    componentRows: [],
  };
}

function formatPrice(price: number | null): string | null {
  return price === null ? null : `${price.toLocaleString('en-US')} EGP`;
}

function formatAvailability(availability: string | null): string {
  return availability
    ? availability
        .toLowerCase()
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Unknown';
}

function compatibilityLabel(status: CompatibilityStatus): string {
  switch (status) {
    case 'COMPATIBLE': return 'Compatible';
    case 'WARNING': return 'Compatible with warnings';
    case 'INCOMPATIBLE': return 'Incompatible';
    case 'UNKNOWN': return 'Unknown';
  }
}

function compatibilityCopy(status: CompatibilityStatus): readonly [string, string] {
  switch (status) {
    case 'COMPATIBLE':
      return ['Compatibility Verified', 'No compatibility conflicts were detected for the selected components.'];
    case 'WARNING':
      return ['Compatible with warnings', 'The build can proceed, but review the compatibility warnings before purchasing.'];
    case 'INCOMPATIBLE':
      return ['Compatibility conflict', 'One or more selected components have a confirmed compatibility conflict.'];
    case 'UNKNOWN':
      return ['Compatibility not fully known', 'Some checks cannot be completed with the compatibility data currently available.'];
  }
}

function mapComponentRow(
  item: PurchasePlanItemDto,
  buildItem: BuildItemDto | undefined,
  compatibility: SlotCompatibilityDto | undefined,
): PurchasePlanComponentRowViewModel {
  const compatibilityStatus = compatibility?.status ?? 'UNKNOWN';
  return {
    slotKey: item.slot,
    slotDisplayName: item.slot.toUpperCase(),
    productId: item.productId,
    productName: item.productName,
    imageUrl: buildItem?.thumbnailUrl ?? null,
    priceLabel: formatPrice(item.totalPrice) ?? '—',
    availabilityLabel: formatAvailability(item.availability),
    compatibilityStatus,
    compatibilityStatusLabel: compatibilityLabel(compatibilityStatus),
    compatibilityReason: compatibility?.topReasons[0] ?? null,
    sourceUrl: item.sourceUrl,
  };
}

/** Join the two existing build endpoints into one presentation model. */
export function mapPurchasePlanPageViewModel(
  build: BuildDto,
  plan: PurchasePlanDto,
): PurchasePlanPageViewModel {
  const buildItems = new Map(build.items.map((item) => [item.productId, item] as const));
  const slotCompatibility = new Map(build.compatibility.slots.map((slot) => [slot.slot, slot] as const));
  const [compatibilityHeading, compatibilityDescription] = compatibilityCopy(build.compatibility.overallStatus);

  return {
    hasBuild: true,
    buildPublicId: build.publicId,
    buildStatusLabel: `Build synced · Version ${build.version}`,
    componentCount: plan.itemCount,
    componentTarget: 7,
    productsScannedLabel: null,
    totalPriceLabel: formatPrice(plan.totalPrice),
    compatibilityStatus: build.compatibility.overallStatus,
    compatibilityStatusLabel: compatibilityLabel(build.compatibility.overallStatus),
    compatibilityHeading,
    compatibilityDescription,
    componentRows: plan.items.map((item) =>
      mapComponentRow(
        item,
        buildItems.get(item.productId),
        slotCompatibility.get(item.slot),
      )),
  };
}

/** UI intents emitted by the purchase plan page. */
export type PurchasePlanUiIntent =
  | { readonly type: 'navigate-builder' }
  | { readonly type: 'navigate-catalog' };
