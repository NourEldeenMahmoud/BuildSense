import * as cheerio from 'cheerio';
import type { AlfrensiaJsonLdProduct } from './types.js';

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductParseResult {
  product: AlfrensiaJsonLdProduct | null;
  breadcrumbs: Array<{ label: string; href: string }>;
  wordpressPostId: string | null;
  visibleTitle: string | null;
  mpn: string | null;
  gtin: string | null;
  visibleStock: string | null;
  specifications: ProductSpecification[];
}

/**
 * Parse an Alfrensia product page HTML.
 *
 * Strategy (precedence):
 * 1. JSON-LD Product from Yoast SEO (first block) + second JSON-LD block with MPN/GTIN
 * 2. WordPress post ID from body class
 * 3. WooCommerce product attributes table for specs
 * 4. Breadcrumbs (limited on Alfrensia - only Home > Shop > Product Name)
 */
export function parseProductPage(html: string): ProductParseResult {
  const $ = cheerio.load(html);

  const { product, breadcrumbs } = extractJsonLdProductConservative($);
  const wordpressPostId = extractWordPressPostId($);
  const visibleTitle = extractVisibleTitle($);
  const { mpn, gtin } = extractMpnGtin($);
  const visibleStock = extractVisibleStock($);
  const specifications = extractSpecifications($);

  return {
    product,
    breadcrumbs,
    wordpressPostId,
    visibleTitle,
    mpn,
    gtin,
    visibleStock,
    specifications,
  };
}

/**
 * Extract Product from multiple JSON-LD blocks, merging conservatively.
 * Never overwrite a non-empty field with an empty one.
 *
 * Alfrensia has two JSON-LD blocks:
 * 1. Yoast SEO: Product with name, sku, brand, offers + BreadcrumbList
 * 2. Second block: Product with mpn, gtin, color, brand, sku, offers
 */
function extractJsonLdProductConservative($: ReturnType<typeof cheerio.load>): {
  product: AlfrensiaJsonLdProduct | null;
  breadcrumbs: Array<{ label: string; href: string }>;
} {
  const scripts = $('script[type="application/ld+json"]');
  let mergedProduct: AlfrensiaJsonLdProduct | null = null;
  let breadcrumbs: Array<{ label: string; href: string }> = [];

  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;

      const graph = extractGraph(parsed);
      if (!graph) continue;

      for (const node of graph) {
        if (node['@type'] === 'Product') {
          const candidate = node as unknown as AlfrensiaJsonLdProduct;
          if (mergedProduct == null) {
            mergedProduct = candidate;
          } else {
            // Conservative merge: never overwrite non-empty with empty
            mergeProductFields(mergedProduct, candidate);
          }
        }
        if (node['@type'] === 'BreadcrumbList' && 'itemListElement' in node) {
          const bc = extractBreadcrumbs(
            node as { itemListElement: Array<{ position: number; item: { name: string; '@id': string } }> },
          );
          if (bc.length > breadcrumbs.length) {
            breadcrumbs = bc;
          }
        }
      }
    } catch {
      // Skip malformed JSON-LD blocks
    }
  }

  return { product: mergedProduct, breadcrumbs };
}

function mergeProductFields(target: AlfrensiaJsonLdProduct, source: AlfrensiaJsonLdProduct): void {
  // Only merge if target field is empty/null/undefined and source has a value
  if (!target.mpn && source.mpn) target.mpn = source.mpn;
  if (!target.gtin && source.gtin) target.gtin = source.gtin;
  if (!target.sku && source.sku) target.sku = source.sku;
  if (!target.description && source.description) target.description = source.description;
  if (!target.image && source.image) target.image = source.image;
  if (!target.brand && source.brand) target.brand = source.brand;

  // Merge offers conservatively
  if (!target.offers && source.offers) {
    target.offers = source.offers;
  }
}

function extractGraph(parsed: unknown): Array<Record<string, unknown>> | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const obj = parsed as Record<string, unknown>;

  if (Array.isArray(obj['@graph'])) {
    return obj['@graph'] as Array<Record<string, unknown>>;
  }

  if (typeof obj['@type'] === 'string') {
    return [obj];
  }

  return null;
}

function extractBreadcrumbs(
  breadcrumbNode: {
    itemListElement: Array<{
      position: number;
      name?: string;
      item?: string | { name: string; '@id': string };
    }>;
  },
): Array<{ label: string; href: string }> {
  return breadcrumbNode.itemListElement
    .sort((a, b) => a.position - b.position)
    .map((entry) => {
      // Some ListItems omit `item` entirely (last breadcrumb = current page).
      if (!entry.item) {
        return { label: entry.name ?? '', href: '' };
      }
      // Yoast SEO format: item is a plain URL string, name at ListItem level.
      if (typeof entry.item === 'string') {
        return { label: entry.name ?? entry.item, href: entry.item };
      }
      // Schema.org format: item is { name, @id }.
      return { label: entry.item.name, href: entry.item['@id'] };
    });
}

/**
 * Extract WordPress post ID from body class.
 * Alfrensia uses: body class contains "postid-{id}"
 */
function extractWordPressPostId($: ReturnType<typeof cheerio.load>): string | null {
  const bodyClass = $('body').attr('class') ?? '';
  const match = bodyClass.match(/\bpostid-(\d+)\b/);
  return match?.[1] ?? null;
}

function extractVisibleTitle($: ReturnType<typeof cheerio.load>): string | null {
  // WordPress/WooCommerce uses h1.product_title or just h1
  const title = $('h1.product_title, h1.entry-title').text().trim();
  if (title) return title;

  // Fallback to h1
  const h1 = $('h1').text().trim();
  return h1 || null;
}

/**
 * Extract MPN and GTIN from the second JSON-LD block.
 * Alfrensia has a second JSON-LD block with structured data including mpn and gtin.
 */
function extractMpnGtin($: ReturnType<typeof cheerio.load>): { mpn: string | null; gtin: string | null } {
  const scripts = $('script[type="application/ld+json"]');
  let mpn: string | null = null;
  let gtin: string | null = null;

  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;

      const obj = parsed as Record<string, unknown>;

      // Check for standalone Product object (not in @graph)
      if (obj['@type'] === 'Product') {
        if (!mpn && typeof obj.mpn === 'string') {
          mpn = obj.mpn;
        }
        if (!gtin && typeof obj.gtin === 'string') {
          gtin = obj.gtin;
        }
      }

      // Check in @graph
      if (Array.isArray(obj['@graph'])) {
        for (const node of obj['@graph'] as Array<Record<string, unknown>>) {
          if (node['@type'] === 'Product') {
            if (!mpn && typeof node.mpn === 'string') {
              mpn = node.mpn;
            }
            if (!gtin && typeof node.gtin === 'string') {
              gtin = node.gtin;
            }
          }
        }
      }
    } catch {
      // Skip malformed JSON-LD blocks
    }
  }

  return { mpn, gtin };
}

function extractVisibleStock($: ReturnType<typeof cheerio.load>): string | null {
  // WooCommerce stock status from availability element
  const stockEl = $('p.stock, .stock');
  if (stockEl.length > 0) {
    return stockEl.text().trim() || null;
  }
  return null;
}

/**
 * Extract specifications from WooCommerce product attributes table.
 * Alfrensia uses: <tr class="woocommerce-product-attributes-item">
 * with th.woocommerce-product-attributes-item__label and
 * td.woocommerce-product-attributes-item__value
 */
function extractSpecifications($: ReturnType<typeof cheerio.load>): ProductSpecification[] {
  const specs: ProductSpecification[] = [];
  const seen = new Set<string>();

  function addSpec(label: string, value: string): void {
    const trimmedLabel = label.trim();
    const trimmedValue = value.trim();
    if (!trimmedLabel || !trimmedValue) return;
    if (trimmedLabel.length > 80) return;
    const key = `${trimmedLabel}=${trimmedValue}`;
    if (seen.has(key)) return;
    seen.add(key);
    specs.push({ label: trimmedLabel, value: trimmedValue });
  }

  // Source 1: WooCommerce product attributes table
  $('tr.woocommerce-product-attributes-item').each((_, row) => {
    const label = $(row).find('th.woocommerce-product-attributes-item__label').text().trim();
    const value = $(row).find('td.woocommerce-product-attributes-item__value').text().trim();
    if (label && value) {
      addSpec(label, value);
    }
  });

  // Source 2: AdditionalInfoSection (if present)
  const additionalInfoEl = $('#additional-information, .woocommerce-product-details__short-description');
  if (additionalInfoEl.length > 0) {
    additionalInfoEl.find('tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const label = $(cells[0]).text().trim();
        const value = $(cells[1]).text().trim();
        addSpec(label, value);
      }
    });
  }

  return specs;
}
