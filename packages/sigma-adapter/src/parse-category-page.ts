import * as cheerio from 'cheerio';
import type { CategoryParseResult, SigmaCategoryProduct, SigmaPagination } from './types.js';
import { extractRscPayloads, deepFindAll, deepFindHasKey } from './rsc-extract.js';
import { isSigmaCategoryProduct } from './validate-product.js';

/**
 * Parse a Sigma category page HTML to extract product cards and pagination.
 *
 * Strategy:
 * 1. Extract RSC flight data (structured JSON with full product objects).
 * 2. Fall back to HTML parsing if RSC data is unavailable.
 */
export function parseCategoryPage(html: string): CategoryParseResult {
  const payloads = extractRscPayloads(html);
  const rscProducts = extractRscProducts(payloads);
  if (rscProducts.length > 0) {
    const pagination = extractPagination(payloads);
    const breadcrumb = extractBreadcrumb(html);
    return { products: rscProducts, pagination, breadcrumb };
  }

  return parseCategoryHtml(html);
}

function extractRscProducts(payloads: unknown[]): SigmaCategoryProduct[] {
  for (const payload of payloads) {
    const containers = deepFindAll(
      payload,
      (node) =>
        typeof node === 'object' &&
        node !== null &&
        !Array.isArray(node) &&
        Array.isArray((node as Record<string, unknown>)['products']),
    );

    for (const container of containers) {
      const products = (container as Record<string, unknown>)['products'];
      if (
        Array.isArray(products) &&
        products.length > 0 &&
        products.every(isSigmaCategoryProduct)
      ) {
        return products;
      }
    }
  }

  return [];
}

function extractPagination(payloads: unknown[]): SigmaPagination {
  for (const payload of payloads) {
    const pag = deepFindHasKey(payload, 'totalPages');
    if (pag && typeof pag['totalPages'] === 'number') {
      return {
        totalItems: pag['totalPages'] as number,
        perPage: (pag['perPage'] as number) ?? 16,
        isNext: (pag['isNext'] as boolean) ?? false,
        isPrevious: (pag['isPrevious'] as boolean) ?? false,
      };
    }
  }

  return { totalItems: 0, perPage: 16, isNext: false, isPrevious: false };
}

function extractBreadcrumb(html: string): Array<{ level: number; label: string; href: string }> {
  const $ = cheerio.load(html);
  const crumbs: Array<{ level: number; label: string; href: string }> = [];
  let level = 1;

  $('nav[aria-label="breadcrumb"] ol li').each((_, li) => {
    const link = $(li).find('a');
    const span = $(li).find('span[aria-current="page"]');
    if (link.length) {
      crumbs.push({
        level,
        label: $(link).text().trim(),
        href: $(link).attr('href') ?? '',
      });
      level++;
    } else if (span.length) {
      crumbs.push({
        level,
        label: $(span).text().trim(),
        href: '',
      });
      level++;
    }
  });

  return crumbs;
}

function parseCategoryHtml(html: string): CategoryParseResult {
  const $ = cheerio.load(html);
  const products: SigmaCategoryProduct[] = [];
  const seen = new Set<string>();

  $('a[href*="/en/item?id="]').each((_, el) => {
    const href: string = $(el).attr('href') ?? '';
    const idMatch = href.match(/\?id=([^&]+)/);
    if (!idMatch) return;
    const slug: string = idMatch[1] ?? '';
    if (seen.has(slug)) return;
    seen.add(slug);

    const card = $(el).closest('.flex.flex-col');
    const name = card
      .find(`a[href="${href}"]`)
      .toArray()
      .map((link) => $(link).text().trim())
      .find(Boolean);
    const priceText: string = (card.find('.font-bold').first().text() ?? '').trim();
    const priceMatch = priceText.match(/\d[\d,]*(?:\.\d+)?/);
    if (!priceMatch) return;
    const price = Number(priceMatch[0].replaceAll(',', ''));
    if (!Number.isFinite(price)) return;

    products.push({
      id: null,
      slug,
      name: name ?? slug,
      sku: null,
      price: {
        base: null,
        current: price,
        discount_percentage: null,
        currency: /\bEGP\b/i.test(priceText) ? 'EGP' : null,
      },
      thumbnail: null,
      category: null,
      brand: null,
      is_stock: null,
      is_discount: null,
    });
  });

  return {
    products,
    pagination: { totalItems: 0, perPage: 16, isNext: false, isPrevious: false },
    breadcrumb: [],
  };
}
