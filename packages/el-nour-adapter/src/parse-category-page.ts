import * as cheerio from 'cheerio';
import type { CategoryParseResult } from '@buildsense/contracts';
import type { ElNourCategoryProduct } from './types.js';

/**
 * Parse an El Nour Tech category page HTML to extract product cards and pagination.
 *
 * Strategy:
 * 1. Select product grid items via `div.wd-product.product-grid-item`.
 * 2. Extract product URL, name, price, SKU, stock status, and thumbnail.
 * 3. Extract pagination from `nav.woocommerce-pagination`.
 */
export function parseCategoryPage(html: string): CategoryParseResult {
  const $ = cheerio.load(html);
  const products: ElNourCategoryProduct[] = [];
  const seen = new Set<string>();

  $('div.wd-product.product-grid-item').each((_, el) => {
    const $el = $(el);

    // Extract WooCommerce product ID from data-id attribute
    const dataId = $el.attr('data-id') ?? null;

    // Extract product URL and slug
    const productLink = $el.find('a.wd-product-img-link').attr('href') ?? '';
    if (!productLink) return;

    // Use data-id or URL slug as external ID
    const externalId = dataId;
    if (externalId && seen.has(externalId)) return;
    if (externalId) seen.add(externalId);

    // Product name from the title link
    const name = $el.find('h3.wd-entities-title a').text().trim();
    if (!name) return;

    // Price from span.price
    const priceEl = $el.find('div.wrap-price span.price');
    const fullPriceText = priceEl.text().trim();

    let priceText: string | null = null;

    // Check for price range (variable product with range display)
    if (fullPriceText.includes('–') || fullPriceText.includes('-')) {
      priceText = fullPriceText;
    } else if ($el.hasClass('sale')) {
      // Sale item: ins = current, del = old
      const insText = priceEl.find('ins span.woocommerce-Price-amount').first().text().trim();
      priceText = insText || null;
    } else {
      // Regular single price
      const amountText = priceEl.find('span.woocommerce-Price-amount').first().text().trim();
      priceText = amountText || fullPriceText || null;
    }

    // SKU from wd-sku span
    const sku = $el.find('span.wd-sku').text().trim() || null;

    // Stock status from CSS classes on the product div
    let isStock: boolean | null = null;
    if ($el.hasClass('instock')) isStock = true;
    else if ($el.hasClass('outofstock')) isStock = false;

    const availabilityText = isStock != null ? String(isStock) : null;

    // Thumbnail from first product image
    const thumbnailUrl =
      $el.find('div.wd-product-thumb img').first().attr('src') ?? null;

    products.push({
      externalId,
      canonicalUrl: productLink,
      name,
      sku,
      priceText,
      oldPriceText: null,
      availabilityText,
      brandName: null,
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
  const paginationNav = $('nav.woocommerce-pagination');
  if (paginationNav.length === 0) {
    return { totalItems: 0, perPage: productsPerPage($), isNext: false, isPrevious: false };
  }

  const currentPage = paginationNav.find('span.page-numbers.current').text().trim();
  const currentPageNum = currentPage ? Number.parseInt(currentPage, 10) : 1;
  const isNext = paginationNav.find('a.next.page-numbers').length > 0;

  // Find the highest page number from the numbered links
  let maxPage = currentPageNum;
  paginationNav.find('a.page-numbers').each((_, el) => {
    const text = $(el).text().trim();
    const num = Number.parseInt(text, 10);
    if (Number.isFinite(num) && num > maxPage) {
      maxPage = num;
    }
  });

  const perPage = productsPerPage($);
  const totalItems = maxPage * perPage;

  return {
    totalItems,
    perPage,
    isNext,
    isPrevious: currentPageNum > 1,
  };
}

function productsPerPage($: ReturnType<typeof cheerio.load>): number {
  const count = $('div.wd-product.product-grid-item').length;
  return count > 0 ? count : 24;
}
