import type { StoreCode, CrawlerRequest, ScrapeFailureKind, HttpFailureInput, RawProductSnapshot } from './crawler.js';

export interface CategoryPageContext {
  url: string;
  html: string;
  categoryHint?: string;
  scrapeRunId: string;
}

export interface ProductPageContext {
  url: string;
  html: string;
  scrapeRunId: string;
}

export interface CategoryParseResult {
  products: Array<{
    externalId: string | null;
    canonicalUrl: string;
    name: string;
    sku: string | null;
    priceText: string | null;
    oldPriceText: string | null;
    availabilityText: string | null;
    brandName: string | null;
    thumbnailUrl: string | null;
    isStock: boolean | null;
  }>;
  pagination: {
    totalItems: number;
    perPage: number;
    isNext: boolean;
    isPrevious: boolean;
  };
}

export interface ParsedRawProduct {
  externalId: string | null;
  canonicalUrl: string;
  sourceUrl: string;
  httpStatus: number;
  responseContentType: string | null;
  raw: RawProductSnapshot['raw'];
  warnings: string[];
}

export interface StoreScraperAdapter {
  readonly storeCode: StoreCode;
  readonly parserVersion: string;

  getSeedRequests(): CrawlerRequest[];

  parseCategoryPage(context: CategoryPageContext): Promise<CategoryParseResult>;

  parseProductPage(context: ProductPageContext): Promise<ParsedRawProduct>;

  extractExternalId(url: URL, html?: string): string | null;

  classifyHttpFailure(input: HttpFailureInput): ScrapeFailureKind;
}
