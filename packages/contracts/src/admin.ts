// ---------------------------------------------------------------------------
// Admin Auth DTOs
// ---------------------------------------------------------------------------

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  ok: true;
}

export interface AdminLogoutResponse {
  ok: true;
}

export interface AdminMeResponse {
  id: string;
  email: string;
  role: 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Admin Read DTOs
// ---------------------------------------------------------------------------

// -- Dashboard ---------------------------------------------------------------

export interface AdminDashboardResponse {
  scrapeRuns: {
    total: number;
    lastRunAt: string | null;
  };
  catalog: {
    totalProducts: number;
    totalOffers: number;
    totalDiscovered: number;
  };
  compatibilityQuality: {
    totalCategories: number;
    allGatesPassCount: number;
    allGatesFailCount: number;
  };
  referenceDatasets: {
    total: number;
  };
  worker: {
    activeLocks: number;
  };
}

// -- Scrape Runs -------------------------------------------------------------

export interface AdminScrapeRunListItem {
  id: string;
  runId: string;
  storeCode: string;
  mode: string;
  status: string;
  stage: string;
  summary: {
    totalDiscovered: number;
    totalFetched: number;
    totalFailed: number;
  } | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AdminScrapeRunListResponse {
  items: AdminScrapeRunListItem[];
  pagination: AdminPagination;
}

export interface AdminScrapeRunItemFailure {
  canonicalUrl: string;
  fetchState: string;
  failureKind: string | null;
  attempts: number;
  categorySeedId: string | null;
}

export interface AdminScrapeRunDetailResponse {
  id: string;
  runId: string;
  storeCode: string;
  mode: string;
  status: string;
  stage: string;
  summary: {
    totalDiscovered: number;
    totalFetched: number;
    totalFailed: number;
    totalMissingPrice?: number;
  } | null;
  categoryAudit: Array<{
    seedId: string;
    pagesProcessed: number;
    productsDiscovered: number;
    completed: boolean;
    failureKind?: string;
  }> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  failures: AdminScrapeRunItemFailure[];
}

// -- Compatibility Quality ---------------------------------------------------

export interface AdminCompatibilityQualityFactMetric {
  factKey: string;
  extractableCount: number;
  coverage: number;
  verifiedCorrect: number | null;
  verifiedSampleSize: number | null;
  precision: number | null;
}

export interface AdminCompatibilityQualityItem {
  category: string;
  extractorVersion: string;
  totalProducts: number;
  factMetrics: AdminCompatibilityQualityFactMetric[];
  allGatesPass: boolean;
  evaluatedAt: string;
}

export interface AdminCompatibilityQualityResponse {
  items: AdminCompatibilityQualityItem[];
}

// -- Worker Status -----------------------------------------------------------

export interface AdminWorkerLockInfo {
  lockKey: string;
  owner: string;
  expiresAt: string;
}

export interface AdminWorkerStatusResponse {
  activeLocks: AdminWorkerLockInfo[];
}

// -- Reference Datasets ------------------------------------------------------

export interface AdminReferenceDatasetItem {
  version: string;
  publishedAt: string;
  citation: string;
  chipsetCount: number;
}

export interface AdminReferenceDatasetListResponse {
  items: AdminReferenceDatasetItem[];
}

// -- Catalog Stats -----------------------------------------------------------

export interface AdminCatalogStatsResponse {
  totalProducts: number;
  totalOffers: number;
  totalDiscovered: number;
  productsByCategory: Array<{ category: string; count: number }>;
  productsByEligibility: {
    eligible: number;
    notEligible: number;
  };
}

// -- Pagination --------------------------------------------------------------

export interface AdminPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// -- Query Params ------------------------------------------------------------

export interface AdminPaginationQuery {
  page?: string;
  pageSize?: string;
}

// ---------------------------------------------------------------------------
// Admin Write DTOs (Phase 4 — Audited Admin Actions)
// ---------------------------------------------------------------------------

// -- Shared ------------------------------------------------------------------

export interface AdminWriteSuccessResponse {
  ok: true;
}

// -- Match Reviews -----------------------------------------------------------

export type AdminMatchReviewStatus = 'PENDING' | 'LINKED' | 'IGNORED' | 'CREATED_PRODUCT';

export interface AdminMatchReviewListItem {
  id: string;
  rawSnapshotId: string;
  canonicalUrl: string;
  storeCode: string;
  status: AdminMatchReviewStatus;
  flagReason: string;
  suggestedCategory: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionReason: string | null;
  linkedProductId: string | null;
  createdProductId: string | null;
  createdAt: string;
}

export interface AdminMatchReviewListResponse {
  items: AdminMatchReviewListItem[];
  pagination: AdminPagination;
}

export interface AdminMatchReviewDetailResponse {
  id: string;
  rawSnapshotId: string;
  canonicalUrl: string;
  storeCode: string;
  status: AdminMatchReviewStatus;
  flagReason: string;
  suggestedCategory: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionReason: string | null;
  linkedProductId: string | null;
  createdProductId: string | null;
  createdAt: string;
}

export interface AdminMatchReviewLinkRequest {
  catalogProductId: string;
  reason: string;
}

export interface AdminMatchReviewIgnoreRequest {
  reason: string;
}

export interface AdminMatchReviewCreateProductRequest {
  title: string;
  category: string;
  brand?: string | null;
  reason: string;
}

// -- Data Quality Issues -----------------------------------------------------

export type AdminDataQualitySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AdminDataQualityIssueStatus = 'OPEN' | 'RESOLVED' | 'IGNORED';

export interface AdminDataQualityIssueListItem {
  id: string;
  issueType: string;
  severity: AdminDataQualitySeverity;
  status: AdminDataQualityIssueStatus;
  category: string | null;
  catalogProductId: string | null;
  rawSnapshotId: string | null;
  description: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  createdAt: string;
}

export interface AdminDataQualityIssueListResponse {
  items: AdminDataQualityIssueListItem[];
  pagination: AdminPagination;
}

export type AdminDataQualityIssueDetailResponse = AdminDataQualityIssueListItem;

export interface AdminDataQualityResolveRequest {
  reason: string;
}

// -- Product Eligibility Overrides -------------------------------------------

export interface AdminEligibilityOverrideRequest {
  eligibility: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  reason: string;
}

export interface AdminEligibilityOverrideResponse {
  ok: true;
  productId: string;
  previousEligibility: string;
  newEligibility: string;
}

export interface AdminEligibilityOverrideListItem {
  id: string;
  productId: string;
  previousEligibility: string;
  newEligibility: string;
  adminId: string;
  reason: string;
  createdAt: string;
}

export interface AdminEligibilityOverrideListResponse {
  items: AdminEligibilityOverrideListItem[];
  pagination: AdminPagination;
}

export type AdminEligibilityOverrideDetailResponse = AdminEligibilityOverrideListItem;

// -- Admin Jobs (Reprocessing / Backfill) ------------------------------------

export type AdminJobType = 'REPROCESS_CATALOG' | 'BACKFILL_FACTS' | 'REPROCESS_CATEGORY';
export type AdminJobStatus = 'PENDING' | 'CLAIMED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface AdminJobListItem {
  id: string;
  jobType: AdminJobType;
  status: AdminJobStatus;
  requestedBy: string;
  reason: string;
  params: Record<string, unknown>;
  claimedBy: string | null;
  claimedAt: string | null;
  attempts: number;
  maxAttempts: number;
  completedAt: string | null;
  result: Record<string, unknown> | null;
  errorSummary: string | null;
  createdAt: string;
}

export interface AdminJobListResponse {
  items: AdminJobListItem[];
  pagination: AdminPagination;
}

export type AdminJobDetailResponse = AdminJobListItem;

export interface AdminJobReprocessRequest {
  jobType: AdminJobType;
  reason: string;
  params?: Record<string, unknown>;
}
