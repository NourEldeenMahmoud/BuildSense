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
import { EL_BADR_STORE_CODE, EL_BADR_PARSER_VERSION } from './identity.js';
import { parseCategoryPage } from './parse-category-page.js';
import { parseProductPage } from './parse-product-page.js';
import { mapElBadrProductToRaw } from './raw-product-mapper.js';
import { classifyElBadrHttpFailure } from './failure-classifier.js';
import {
  buildElBadrCategoryUrl,
  isElBadrProductUrl,
  canonicalizeElBadrUrl,
} from './urls.js';
import { EL_BADR_CATEGORY_SEEDS } from './category-seeds.js';

export class ElBadrScraperAdapter implements StoreScraperAdapter {
  readonly storeCode = EL_BADR_STORE_CODE;
  readonly parserVersion = EL_BADR_PARSER_VERSION;

  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  getSeedRequests(): CrawlerRequest[] {
    const seeds = getEnabledCategorySeeds();
    return seeds.map((seed) => ({
      url: buildElBadrCategoryUrl(this.baseUrl, seed.url),
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

    // Determine category hint from adapter's enabled seeds.
    // El Badr adapter is currently CPU-only; inject adapter-level category
    // evidence so the raw snapshot carries it without title guessing.
    const enabledSeeds = getEnabledCategorySeeds();
    const categoryHint = enabledSeeds.length === 1 ? enabledSeeds[0]!.id : undefined;

    const { externalId, raw, warnings } = mapElBadrProductToRaw({
      product: result.product,
      openCartProductId: result.openCartProductId,
      visibleTitle: result.visibleTitle,
      visibleModel: result.visibleModel,
      visibleMpn: result.visibleMpn,
      visibleStock: result.visibleStock,
      breadcrumbs: result.breadcrumbs,
      specifications: result.specifications,
      categoryHint,
    });

    return {
      externalId,
      canonicalUrl: canonicalizeElBadrUrl(new URL(context.url)),
      sourceUrl: context.url,
      httpStatus: 200,
      responseContentType: 'text/html',
      raw,
      warnings,
    };
  }

  extractExternalId(url: URL, html?: string): string | null {
    if (isElBadrProductUrl(url, new URL(this.baseUrl).hostname)) {
      // Try to extract OpenCart product_id from HTML
      if (html != null) {
        const inputMatch = html.match(/name=["']product_id["'][^>]*value=["'](\d+)["']/);
        if (inputMatch?.[1]) return inputMatch[1];

        const dataMatch = html.match(/data-product-id=["'](\d+)["']/);
        if (dataMatch?.[1]) return dataMatch[1];
      }
      return null;
    }

    return null;
  }

  classifyHttpFailure(input: HttpFailureInput): ScrapeFailureKind {
    return classifyElBadrHttpFailure(input);
  }

  isValidOrigin(url: URL): boolean {
    return url.hostname === new URL(this.baseUrl).hostname;
  }
}

function getEnabledCategorySeeds(): typeof EL_BADR_CATEGORY_SEEDS {
  return EL_BADR_CATEGORY_SEEDS.filter((s) => s.enabled !== false);
}
