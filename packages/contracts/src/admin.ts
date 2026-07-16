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
