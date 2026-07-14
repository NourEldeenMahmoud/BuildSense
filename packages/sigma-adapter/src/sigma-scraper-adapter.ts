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
import { SIGMA_STORE_CODE, SIGMA_PARSER_VERSION, normalizeExternalId } from './identity.js';
import { parseCategoryPage as parseCategoryRsc } from './parse-category-page.js';
import { parseProductPage as parseProductRsc } from './parse-product-page.js';
import { mapSigmaProductToRaw } from './raw-product-mapper.js';
import { classifySigmaHttpFailure } from './failure-classifier.js';
import {
  buildSigmaCategoryUrl,
  buildSigmaProductUrl,
  isSigmaProductUrl,
  extractSigmaCategoryId,
  canonicalizeSigmaUrl,
} from './urls.js';
import { SIGMA_CATEGORY_SEEDS } from './category-seeds.js';

const SIGMA_HOST = 'www.sigma-computer.com';

export class SigmaScraperAdapter implements StoreScraperAdapter {
  readonly storeCode = SIGMA_STORE_CODE;
  readonly parserVersion = SIGMA_PARSER_VERSION;

  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  getSeedRequests(): CrawlerRequest[] {
    const seeds = getEnabledCategorySeeds();
    return seeds.map((seed) => ({
      url: buildSigmaCategoryUrl(this.baseUrl, seed.sigmaId),
      userData: {
        label: 'CATEGORY_PAGE',
        categoryHint: seed.id,
        pageNumber: 1,
        scrapeRunId: '',
      },
    }));
  }

  async parseCategoryPage(context: CategoryPageContext): Promise<CategoryParseResult> {
    const result = parseCategoryRsc(context.html);
    return {
      products: result.products.map((p) => ({
        externalId: normalizeExternalId(p.id),
        canonicalUrl: buildSigmaProductUrl(this.baseUrl, p.slug),
        name: p.name,
        sku: p.sku,
        priceText: p.price?.current != null ? String(p.price.current) : null,
        oldPriceText: p.price?.base != null ? String(p.price.base) : null,
        availabilityText: p.is_stock != null ? String(p.is_stock) : null,
        brandName: p.brand?.name ?? null,
        thumbnailUrl: p.thumbnail?.url ?? null,
        isStock: p.is_stock,
      })),
      pagination: result.pagination,
    };
  }

  async parseProductPage(context: ProductPageContext): Promise<ParsedRawProduct> {
    const result = parseProductRsc(context.html);
    if (!result) {
      throw new Error('PARSE_FAILED: Could not extract product from RSC data');
    }

    const { externalId, raw, warnings } = mapSigmaProductToRaw(
      result.product,
      result.breadcrumb,
    );

    return {
      externalId,
      canonicalUrl: canonicalizeSigmaUrl(new URL(context.url)),
      sourceUrl: context.url,
      httpStatus: 200,
      responseContentType: 'text/html',
      raw,
      warnings,
    };
  }

  extractExternalId(url: URL, _html?: string): string | null {
    if (isSigmaProductUrl(url, SIGMA_HOST)) {
      const idParam = url.searchParams.get('id');
      return idParam ?? null;
    }

    const categoryId = extractSigmaCategoryId(url);
    return categoryId;
  }

  classifyHttpFailure(input: HttpFailureInput): ScrapeFailureKind {
    return classifySigmaHttpFailure(input);
  }

  isValidOrigin(url: URL): boolean {
    return url.hostname === new URL(this.baseUrl).hostname;
  }
}

function getEnabledCategorySeeds(): typeof SIGMA_CATEGORY_SEEDS {
  return SIGMA_CATEGORY_SEEDS.filter((s) => s.enabled !== false);
}
