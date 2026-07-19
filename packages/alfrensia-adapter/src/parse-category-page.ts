import * as cheerio from 'cheerio';
import type { CategoryParseResult } from '@buildsense/contracts';
import type { AlfrensiaCategoryProduct } from './types.js';

/**
 * Parse an Alfrensia category page HTML to extract product cards and pagination.
 *
 * Strategy:
 * 1. Select product grid items via `div.product-small[data-product-id]`.
 * 2. Extract product URL, name, price, stock status, and SKU.
 * 3. Extract pagination from WooCommerce pagination links.
 *
 * Alfrensia uses WordPress/WooCommerce with Flatsome theme.
 * Category cards show product title, price, and short description.
 */
export function parseCategoryPage(html: string): CategoryParseResult {
  const $ = cheerio.load(html);
  const products: AlfrensiaCategoryProduct[] = [];
  const seen = new Set<string>();

  // Alfrensia product cards: div.product-small with data-product_id attribute
  // Note: Alfrensia uses underscore in attribute name (data-product_id), not hyphen
  $('div.product-small[data-product_id]').each((_, el) => {
    const $el = $(el);

    // Extract WordPress product ID from data-product_id attribute (Alfrensia uses underscore)
    const dataId = $el.attr('data-product_id') ?? $el.attr('data-product-id') ?? null;

    // Extract product URL and name from the product title link
    const productLink = $el.find('p.name.product-title a').attr('href') ?? '';
    if (!productLink) return;

    // Use data-id as external ID (stable WordPress product ID)
    const externalId = dataId;
    if (externalId && seen.has(externalId)) return;
    if (externalId) seen.add(externalId);

    // Product name from the title link
    const name = $el.find('p.name.product-title a').text().trim();
    if (!name) return;

    // Price extraction - Flatsome theme uses span.price with ins/del for sale prices
    let priceText: string | null = null;
    let oldPriceText: string | null = null;

    const priceEl = $el.find('span.price');
    if (priceEl.length > 0) {
      // Check for sale price (ins element) vs regular price (del element)
      const insPrice = priceEl.find('ins .woocommerce-Price-amount').text().trim();
      const delPrice = priceEl.find('del .woocommerce-Price-amount').text().trim();

      if (insPrice) {
        priceText = insPrice || null;
        if (delPrice) {
          oldPriceText = delPrice || null;
        }
      } else {
        // No sale price, use the regular price
        const regularPrice = priceEl.find('.woocommerce-Price-amount').text().trim();
        priceText = regularPrice || null;
      }
    }

    // Extract SKU from add-to-cart button
    const sku = $el.find('a.add_to_cart_button').attr('data-product_sku') ?? null;

    // Stock status from CSS class
    let isStock: boolean | null = null;
    const classAttr = $el.attr('class') ?? '';
    if (classAttr.includes('outofstock') || classAttr.includes('out-of-stock')) {
      isStock = false;
    } else if (classAttr.includes('instock') || classAttr.includes('in-stock')) {
      isStock = true;
    }

    const availabilityText = isStock === true ? 'In Stock' : isStock === false ? 'Out of Stock' : null;

    products.push({
      externalId,
      canonicalUrl: productLink,
      name,
      sku,
      priceText,
      oldPriceText,
      availabilityText,
      brandName: null, // Brand not reliably available on category cards
      thumbnailUrl: null, // Thumbnail extraction not critical for MVP
      isStock,
    });
  });

  // Pagination - WooCommerce style
  const pagination = extractPagination($);

  return { products, pagination };
}

function extractPagination(
  $: ReturnType<typeof cheerio.load>,
): CategoryParseResult['pagination'] {
  // Alfrensia uses WooCommerce pagination: nav.woocommerce-pagination
  const paginationLinks = $('nav.woocommerce-pagination a, .woocommerce-pagination a');

  // Find the highest page number from links
  let maxPage = 1;
  paginationLinks.each((_, el) => {
    const href = $(el).attr('href') ?? '';
    // WooCommerce pagination URLs: /page/2/
    const pageMatch = href.match(/\/page\/(\d+)/);
    if (pageMatch?.[1]) {
      const num = Number.parseInt(pageMatch[1], 10);
      if (Number.isFinite(num) && num > maxPage) {
        maxPage = num;
      }
    }
  });

  // Check for current page in pagination
  let currentPageNum = 1;
  const currentSpan = $('nav.woocommerce-pagination .current, .woocommerce-pagination .current');
  if (currentSpan.length > 0) {
    const text = currentSpan.first().text().trim();
    const num = Number.parseInt(text, 10);
    if (Number.isFinite(num)) {
      currentPageNum = num;
    }
  }

  const isNext = maxPage > currentPageNum;
  const isPrevious = currentPageNum > 1;

  // Count products on current page
  const perPage = $('div.product-small[data-product_id]').length;
  const totalItems = maxPage * perPage;

  return {
    totalItems,
    perPage: perPage > 0 ? perPage : 12,
    isNext,
    isPrevious,
  };
}
