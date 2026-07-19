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
import { ALFRENSIA_STORE_CODE, ALFRENSIA_PARSER_VERSION } from './identity.js';
import { parseCategoryPage } from './parse-category-page.js';
import { parseProductPage } from './parse-product-page.js';
import { mapAlfrensiaProductToRaw } from './raw-product-mapper.js';
import { classifyAlfrensiaHttpFailure } from './failure-classifier.js';
import {
  buildAlfrensiaCategoryUrl,
  isAlfrensiaProductUrl,
  canonicalizeAlfrensiaUrl,
} from './urls.js';
import { ALFRENSIA_CATEGORY_SEEDS } from './category-seeds.js';

export class AlfrensiaScraperAdapter implements StoreScraperAdapter {
  readonly storeCode = ALFRENSIA_STORE_CODE;
  readonly parserVersion = ALFRENSIA_PARSER_VERSION;

  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  getSeedRequests(): CrawlerRequest[] {
    const seeds = getEnabledCategorySeeds();
    return seeds.map((seed) => ({
      url: buildAlfrensiaCategoryUrl(this.baseUrl, seed.url),
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
    // Alfrensia adapter is currently MONITOR-only; inject adapter-level category
    // evidence so the raw snapshot carries it without title guessing.
    const enabledSeeds = getEnabledCategorySeeds();
    const categoryHint = enabledSeeds.length === 1 ? enabledSeeds[0]!.id : undefined;

    const { externalId, raw, warnings } = mapAlfrensiaProductToRaw({
      product: result.product,
      wordpressPostId: result.wordpressPostId,
      visibleTitle: result.visibleTitle,
      mpn: result.mpn,
      gtin: result.gtin,
      visibleStock: result.visibleStock,
      breadcrumbs: result.breadcrumbs,
      specifications: result.specifications,
      categoryHint,
    });

    return {
      externalId,
      canonicalUrl: canonicalizeAlfrensiaUrl(new URL(context.url)),
      sourceUrl: context.url,
      httpStatus: 200,
      responseContentType: 'text/html',
      raw,
      warnings,
    };
  }

  extractExternalId(url: URL, html?: string): string | null {
    if (isAlfrensiaProductUrl(url, new URL(this.baseUrl).hostname)) {
      // Try to extract WordPress post ID from HTML
      if (html != null) {
        const bodyMatch = html.match(/\bpostid-(\d+)\b/);
        if (bodyMatch?.[1]) return bodyMatch[1];

        const dataMatch = html.match(/data-product-id=["'](\d+)["']/);
        if (dataMatch?.[1]) return dataMatch[1];
      }
      return null;
    }

    return null;
  }

  classifyHttpFailure(input: HttpFailureInput): ScrapeFailureKind {
    return classifyAlfrensiaHttpFailure(input);
  }

  isValidOrigin(url: URL): boolean {
    return url.hostname === new URL(this.baseUrl).hostname;
  }
}

function getEnabledCategorySeeds(): typeof ALFRENSIA_CATEGORY_SEEDS {
  return ALFRENSIA_CATEGORY_SEEDS.filter((s) => s.enabled !== false);
}
