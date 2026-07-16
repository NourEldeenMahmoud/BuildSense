/** Build slot name matching the URL path parameter. */
export type BuildSlotName =
  | 'cpu'
  | 'motherboard'
  | 'ram'
  | 'gpu'
  | 'storage'
  | 'psu'
  | 'case';

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

/** A candidate product for slot selection. */
export interface CandidateProductDto {
  readonly productId: string;
  readonly name: string;
  readonly thumbnailUrl: string | null;
  readonly price: number | null;
  readonly sourceUrl: string;
  readonly storeCode: string;
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
