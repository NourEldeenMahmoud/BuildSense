import * as cheerio from 'cheerio';
import type { CategoryParseResult } from '@buildsense/contracts';
import type { ElBadrCategoryProduct } from './types.js';

/**
 * Parse an El Badr Group category page HTML to extract product cards and pagination.
 *
 * Strategy:
 * 1. Select product grid items via `div.product-layout[data-product-id]`.
 * 2. Extract product URL, name, price, model, stock status, brand, and thumbnail.
 * 3. Extract pagination from page links.
 *
 * El Badr uses OpenCart 3 + Journal 3 with clean product URLs.
 * Category cards show brand, model, description snippet, and price.
 */
export function parseCategoryPage(html: string): CategoryParseResult {
  const $ = cheerio.load(html);
  const products: ElBadrCategoryProduct[] = [];
  const seen = new Set<string>();

  // El Badr product cards: div.product-layout with data-product-id
  // Only select cards inside the main product grid (div.main-products), not
  // recommendation carousels (div.module-products) which share the same card markup.
  // The main grid has data-product-count set by OpenCart's pagination config.
  $('div.main-products .product-layout[data-product-id]').each((_, el) => {
    const $el = $(el);

    // Extract OpenCart product ID from data-product-id attribute
    const dataId = $el.attr('data-product-id') ?? null;

    // Extract product URL and name from the caption link
    const productLink = $el.find('div.name a').attr('href') ?? '';
    if (!productLink) return;

    // Use data-id as external ID (stable internal product ID)
    const externalId = dataId;
    if (externalId && seen.has(externalId)) return;
    if (externalId) seen.add(externalId);

    // Product name from the caption link
    const name = $el.find('div.name a').text().trim();
    if (!name) return;

    // Price extraction - El Badr uses price-new / price-old spans
    let priceText: string | null = null;
    let oldPriceText: string | null = null;

    const priceNewEl = $el.find('span.price-new');
    const priceOldEl = $el.find('span.price-old');

    if (priceNewEl.length > 0) {
      priceText = priceNewEl.first().text().trim() || null;
    }
    if (priceOldEl.length > 0) {
      oldPriceText = priceOldEl.first().text().trim() || null;
    }

    // Fallback: generic price span
    if (priceText == null) {
      const priceEl = $el.find('div.price');
      if (priceEl.length > 0) {
        const rawPrice = priceEl.text().trim();
        // Extract first price value from text like "8,299 EGP"
        const match = rawPrice.match(/[\d,]+\.?\d*/);
        priceText = match ? match[0] : null;
      }
    }

    // Stock status from CSS class on product-layout div
    let isStock: boolean | null = null;
    const classAttr = $el.attr('class') ?? '';
    if (classAttr.includes('out-of-stock')) {
      isStock = false;
    } else {
      isStock = true; // Default to in-stock if not marked out-of-stock
    }

    const availabilityText = isStock ? 'In Stock' : 'Out of Stock';

    // Brand from caption
    const brandText = $el.find('div.caption a[href*="/amd"], div.caption a[href*="/intel"]').text().trim() || null;

    // Thumbnail from product image
    const thumbnailUrl =
      $el.find('div.image img').first().attr('src') ?? null;

    products.push({
      externalId,
      canonicalUrl: productLink,
      name,
      sku: null, // Not available on category cards
      priceText,
      oldPriceText,
      availabilityText,
      brandName: brandText,
      thumbnailUrl,
      isStock,
    });
  });

  // Pagination
  const pagination = extractPagination($);

  return { products, pagination };
}

function extractPagination(
  $: ReturnType<typeof cheerio.load>,
): CategoryParseResult['pagination'] {
  // El Badr uses standard OpenCart pagination
  const paginationLinks = $('div.pagination a, ul.pagination a');
  const paginationNums = $('div.pagination span, ul.pagination span');

  // Find current page from active/current span
  let currentPageNum = 1;
  paginationNums.each((_, el) => {
    const text = $(el).text().trim();
    const num = Number.parseInt(text, 10);
    if (Number.isFinite(num) && num > currentPageNum) {
      // Current page is usually the last span that's not a "next" link
    }
  });

  // Find the highest page number from links
  let maxPage = 1;
  paginationLinks.each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const pageMatch = href.match(/page=(\d+)/);
    if (pageMatch?.[1]) {
      const num = Number.parseInt(pageMatch[1], 10);
      if (Number.isFinite(num) && num > maxPage) {
        maxPage = num;
      }
    }
  });

  // Check for current page in pagination
  const currentSpan = $('div.pagination span.active, ul.pagination span.active, div.pagination span.current, ul.pagination span.current');
  if (currentSpan.length > 0) {
    const text = currentSpan.first().text().trim();
    const num = Number.parseInt(text, 10);
    if (Number.isFinite(num)) {
      currentPageNum = num;
    }
  }

  const isNext = maxPage > currentPageNum;
  const isPrevious = currentPageNum > 1;

  // Count products on current page (main grid only, excluding recommendation carousels)
  const perPage = $('div.main-products .product-layout[data-product-id]').length;
  const totalItems = maxPage * perPage;

  return {
    totalItems,
    perPage: perPage > 0 ? perPage : 12,
    isNext,
    isPrevious,
  };
}
