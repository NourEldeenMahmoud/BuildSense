import type {
  StoreScraperAdapter,
  CategoryPageContext,
  ProductPageContext,
  CategoryParseResult,
  ParsedRawProduct,
  CrawlerRequest,
  ScrapeFailureKind,
  HttpFailureInput,
} from '@buildsense/contracts';
import { EL_NOUR_STORE_CODE, EL_NOUR_PARSER_VERSION } from './identity.js';
import { parseCategoryPage } from './parse-category-page.js';
import { parseProductPage } from './parse-product-page.js';
import { mapElNourProductToRaw } from './raw-product-mapper.js';
import { classifyElNourHttpFailure } from './failure-classifier.js';
import {
  buildElNourLocalizedCategoryUrl,
  isElNourProductUrl,
  extractElNourCategorySlug,
  canonicalizeElNourUrl,
} from './urls.js';
import { EL_NOUR_CATEGORY_SEEDS } from './category-seeds.js';

export class ElNourScraperAdapter implements StoreScraperAdapter {
  readonly storeCode = EL_NOUR_STORE_CODE;
  readonly parserVersion = EL_NOUR_PARSER_VERSION;

  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  getSeedRequests(): CrawlerRequest[] {
    const seeds = getEnabledCategorySeeds();
    return seeds.map((seed) => ({
      url: buildElNourLocalizedCategoryUrl(this.baseUrl, seed.url),
      userData: {
        label: 'CATEGORY_PAGE',
        categoryHint: seed.id,
        pageNumber: 1,
        scrapeRunId: '',
      },
    }));
  }

  async parseCategoryPage(context: CategoryPageContext): Promise<CategoryParseResult> {
    return parseCategoryPage(context.html);
  }

  async parseProductPage(context: ProductPageContext): Promise<ParsedRawProduct> {
    const result = parseProductPage(context.html);

    const { externalId, raw, warnings } = mapElNourProductToRaw({
      product: result.product,
      wooProductId: result.wooProductId,
      sku: result.sku,
      variations: result.variations,
      isVariable: result.isVariable,
      breadcrumbs: result.breadcrumbs,
      specifications: result.specifications,
    });

    return {
      externalId,
      canonicalUrl: canonicalizeElNourUrl(new URL(context.url)),
      sourceUrl: context.url,
      httpStatus: 200,
      responseContentType: 'text/html',
      raw,
      warnings,
    };
  }

  extractExternalId(url: URL, html?: string): string | null {
    if (isElNourProductUrl(url, new URL(this.baseUrl).hostname)) {
      // Try to extract from body class in HTML
      if (html != null) {
        const match = html.match(/postid-(\d+)/);
        if (match?.[1]) return match[1];
      }
      return null;
    }

    const categorySlug = extractElNourCategorySlug(url);
    return categorySlug;
  }

  classifyHttpFailure(input: HttpFailureInput): ScrapeFailureKind {
    return classifyElNourHttpFailure(input);
  }

  isValidOrigin(url: URL): boolean {
    return url.hostname === new URL(this.baseUrl).hostname;
  }
}

function getEnabledCategorySeeds(): typeof EL_NOUR_CATEGORY_SEEDS {
  return EL_NOUR_CATEGORY_SEEDS.filter((s) => s.enabled !== false);
}
