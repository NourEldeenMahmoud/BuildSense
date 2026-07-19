/** Build slot name matching the URL path parameter. */
export type BuildSlotName =
  | 'cpu'
  | 'motherboard'
  | 'ram'
  | 'gpu'
  | 'storage'
  | 'psu'
  | 'case'
  | 'cooling';

/** Per-slot compatibility status. */
export type CompatibilityStatus = 'UNKNOWN' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'WARNING';

/**
 * Four-group candidate classification per TDD §15.8.
 * CandidateCompatibilityGroupDto.status uses this instead of CompatibilityStatus.
 */
export type CandidateCompatibilityGroup =
  | 'COMPATIBLE'
  | 'COMPATIBLE_WITH_WARNINGS'
  | 'INCOMPATIBLE'
  | 'UNKNOWN';

/** An item occupying a single build slot. */
export interface BuildItemDto {
  readonly productId: string;
  readonly slot: BuildSlotName;
  readonly quantity: number;
  readonly unitPrice: number | null;
  readonly totalPrice: number | null;
  readonly productName: string;
  readonly thumbnailUrl: string | null;
  readonly sourceUrl: string;
  readonly storeCode: string;
}

/** Per-slot compatibility result. */
export interface SlotCompatibilityDto {
  readonly slot: BuildSlotName;
  readonly status: CompatibilityStatus;
  readonly triggeredRuleIds: readonly string[];
  /** Top human-readable reasons for the slot status (for UI display). */
  readonly topReasons: readonly string[];
  /** Canonical fact keys absent and causing an UNKNOWN status; empty for other statuses. */
  readonly missingFactKeys: readonly string[];
}

/** Overall build compatibility result. */
export interface BuildCompatibilityDto {
  readonly overallStatus: CompatibilityStatus;
  readonly slots: readonly SlotCompatibilityDto[];
}

/** Pricing snapshot for the build. */
export interface BuildPricingDto {
  readonly totalPrice: number | null;
  readonly itemCount: number;
}

/** Canonical build representation returned by all build endpoints. */
export interface BuildDto {
  readonly publicId: string;
  readonly name: string;
  readonly version: number;
  readonly items: readonly BuildItemDto[];
  readonly compatibility: BuildCompatibilityDto;
  readonly pricing: BuildPricingDto;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Request body for POST /api/v1/builds. */
export interface CreateBuildRequest {
  readonly name?: string;
}

/** Request body for PATCH /api/v1/builds/:publicId. */
export interface UpdateBuildRequest {
  readonly name?: string;
  readonly expectedVersion: number;
}

/** Request body for PUT /api/v1/builds/:publicId/items/:slot. */
export interface PutItemRequest {
  readonly productId: string;
  readonly quantity: number;
  readonly expectedVersion: number;
}

/** Request body for DELETE /api/v1/builds/:publicId/items/:slot. */
export interface DeleteItemRequest {
  readonly expectedVersion: number;
}

/** A single item in the purchase plan. */
export interface PurchasePlanItemDto {
  readonly productId: string;
  readonly productName: string;
  readonly slot: BuildSlotName;
  readonly quantity: number;
  readonly unitPrice: number | null;
  readonly totalPrice: number | null;
  readonly sourceUrl: string;
  readonly storeCode: string;
  readonly availability: string | null;
  readonly lastSeenAt: string | null;
}

/** Shopping list response for the purchase plan endpoint. */
export interface PurchasePlanDto {
  readonly buildPublicId: string;
  readonly items: readonly PurchasePlanItemDto[];
  readonly totalPrice: number | null;
  readonly itemCount: number;
}

/** Candidate availability filter. */
export type CandidateAvailabilityFilter = 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK';

/** Availability of a specific offer. */
export type OfferAvailability = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';

/** A single store offer for a candidate product. */
export interface CandidateOfferDto {
  readonly storeCode: string;
  readonly price: number;
  readonly currency: string | null;
  readonly availability: OfferAvailability;
  readonly sourceUrl: string;
}

/** A candidate product for slot selection. */
export interface CandidateProductDto {
  readonly productId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly thumbnailUrl: string | null;
  /** Best offer price (lowest matching price for the current availability filter). */
  readonly price: number | null;
  /** Best offer source URL. */
  readonly sourceUrl: string;
  /** Best offer store code. */
  readonly storeCode: string;
  /** Best offer availability. */
  readonly availability: OfferAvailability;
  /** All valid offers for this product, sorted deterministically. */
  readonly offers: readonly CandidateOfferDto[];
}

/** Products grouped by compatibility status for the candidates endpoint. */
export interface CandidateCompatibilityGroupDto {
  readonly status: CandidateCompatibilityGroup;
  readonly products: readonly CandidateProductDto[];
  readonly topReasons: readonly string[];
}

/** Pagination metadata for candidates response. */
export interface CandidatesPaginationDto {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

/** Paginated candidates response. */
export interface CandidatesApiResponse {
  readonly groups: readonly CandidateCompatibilityGroupDto[];
  readonly pagination: CandidatesPaginationDto;
}

// ---------------------------------------------------------------------------
// Error DTOs
// ---------------------------------------------------------------------------

/** Standard API error response body. */
export interface BuildApiErrorResponse {
  readonly error: string;
  readonly requestId: string;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
}

/** 409 conflict error response with version mismatch details. */
export interface BuildVersionConflictError extends BuildApiErrorResponse {
  readonly code: 'BUILD_VERSION_CONFLICT';
  readonly details: {
    readonly expectedVersion: number;
    readonly currentVersion: number;
    readonly latestBuild: BuildDto;
  };
}
