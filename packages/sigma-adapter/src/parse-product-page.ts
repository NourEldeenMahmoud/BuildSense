import * as cheerio from 'cheerio';
import type { ProductParseResult, SigmaProduct } from './types.js';
import { extractRscPayloads, deepFindAll } from './rsc-extract.js';
import { isSigmaProduct } from './validate-product.js';

/**
 * Parse a Sigma product page HTML to extract the full product object.
 *
 * Strategy:
 * 1. Extract RSC flight data to find the complete product object.
 * 2. If RSC extraction fails, return null (HTML-only fallback is not implemented).
 */
export function parseProductPage(html: string): ProductParseResult | null {
  const product = extractProductFromRsc(html);
  if (!product) return null;

  return {
    product,
    breadcrumb: extractBreadcrumb(html),
  };
}

function extractBreadcrumb(html: string): ProductParseResult['breadcrumb'] {
  const $ = cheerio.load(html);
  const breadcrumb: ProductParseResult['breadcrumb'] = [];
  let level = 1;

  $('nav[aria-label="breadcrumb"] ol li').each((_, listItem) => {
    const link = $(listItem).find('a');
    const current = $(listItem).find('span[aria-current="page"]');

    if (link.length) {
      breadcrumb.push({
        level,
        label: link.text().trim(),
        href: link.attr('href') ?? '',
      });
      level++;
    } else if (current.length) {
      breadcrumb.push({
        level,
        label: current.text().trim(),
        href: '',
      });
      level++;
    }
  });

  return breadcrumb;
}

function extractProductFromRsc(html: string): SigmaProduct | null {
  const payloads = extractRscPayloads(html);

  for (const payload of payloads) {
    const found = findProductInPayload(payload);
    if (found) return found;
  }

  return null;
}

function findProductInPayload(payload: unknown): SigmaProduct | null {
  const candidates = deepFindAll(payload, isSigmaProduct);

  for (const candidate of candidates) {
    if (isSigmaProduct(candidate)) return candidate;
  }

  return null;
}
