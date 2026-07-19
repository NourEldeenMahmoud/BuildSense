export type StoreCode = 'SIGMA' | 'EL_NOUR' | 'EL_BADR' | 'ALFRENSIA';

/**
 * Human-readable labels for store codes.
 * Use this for UI rendering instead of raw store codes.
 */
export const STORE_LABELS: Record<StoreCode, string> = {
  SIGMA: 'Sigma Computer',
  EL_NOUR: 'El Nour Tech',
  EL_BADR: 'El Badr Group',
  ALFRENSIA: 'Alfrensia Computer',
};

/**
 * Get human-readable label for a store code.
 * Falls back to the raw code if somehow an unknown code is passed.
 */
export function getStoreLabel(code: StoreCode): string {
  return STORE_LABELS[code] ?? code;
}

export type CrawlerRequestLabel =
  | 'CATEGORY_PAGE'
  | 'PRODUCT_PAGE'
  | 'ROBOTS_CHECK'
  | 'HEALTH_SAMPLE';

export interface CrawlerRequestData {
  label: CrawlerRequestLabel;
  categoryHint?: string;
  pageNumber?: number;
  discoverySourceUrl?: string;
  scrapeRunId: string;
}

export interface CrawlerRequest {
  url: string;
  userData: CrawlerRequestData;
}

export type ScrapeFailureKind =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'HTTP_408'
  | 'HTTP_429'
  | 'HTTP_5XX'
  | 'HTTP_4XX'
  | 'ROBOTS_DENIED'
  | 'OFF_DOMAIN_REDIRECT'
  | 'BLOCKED_RESPONSE'
  | 'INVALID_CONTENT_TYPE'
  | 'PARSE_FAILED'
  | 'PERSISTENCE_FAILED'
  | 'PAGINATION_LOOP'
  | 'PAGE_LIMIT_EXCEEDED';

export interface HttpFailureInput {
  httpStatus?: number;
  contentType?: string;
  message?: string;
  redirectUrl?: string;
}

export type ScrapeRunStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIALLY_FAILED'
  | 'FAILED'
  | 'CANCELLED';

export type ScrapeRunStage = 'DISCOVERY' | 'FETCH';

export type ScrapeRunMode = 'FULL' | 'CATEGORY' | 'URL';

export type ItemFetchState = 'PENDING' | 'FETCHED' | 'FAILED' | 'SKIPPED';

export type ContentStorage = 'FILE' | 'INLINE' | 'OBJECT_STORAGE';

export type ParseStatus = 'OK' | 'FAILED';

export interface RawProductSnapshot {
  storeCode: StoreCode;
  externalId: string | null;
  canonicalUrl: string;
  sourceUrl: string;
  scrapeRunId: string;

  fetchedAt: Date;
  httpStatus: number;
  responseContentType: string | null;
  contentSha256: string;
  contentStorage: ContentStorage;
  contentPath?: string;

  parserVersion: string;
  parseStatus: ParseStatus;
  raw: {
    title: string | null;
    priceText: string | null;
    oldPriceText: string | null;
    availabilityText: string | null;
    skuText: string | null;
    brandText: string | null;
    modelText: string | null;
    partNumberText: string | null;
    breadcrumbs: string[];
    specifications: Array<{ label: string; value: string }>;
    imageUrls: string[];
    descriptionText: string | null;
  };

  parseWarnings: string[];
  createdAt: Date;
}

export interface ScrapeRunItem {
  scrapeRunId: string;
  canonicalUrl: string;
  categorySeedId?: string;
  discoverySourceUrl?: string;
  fetchState: ItemFetchState;
  attempts: number;
  failureKind?: ScrapeFailureKind;
  snapshotId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScrapeRun {
  storeCode: StoreCode;
  runId: string;
  mode: ScrapeRunMode;
  status: ScrapeRunStatus;
  stage: ScrapeRunStage;
  commandInput?: string;
  robotsDecision?: 'ALLOWED' | 'DENIED' | 'NOT_FOUND';
  healthGates?: Record<string, boolean>;
  summary?: {
    totalDiscovered: number;
    totalFetched: number;
    totalFailed: number;
  };
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
