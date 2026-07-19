import * as cheerio from 'cheerio';
import type { ElBadrJsonLdProduct } from './types.js';

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductParseResult {
  product: ElBadrJsonLdProduct | null;
  breadcrumbs: Array<{ label: string; href: string }>;
  openCartProductId: string | null;
  visibleTitle: string | null;
  visibleModel: string | null;
  visibleMpn: string | null;
  visibleStock: string | null;
  specifications: ProductSpecification[];
}

/**
 * Parse an El Badr Group product page HTML.
 *
 * Strategy (precedence):
 * 1. Visible HTML elements: title, price, stock, model, MPN, product ID
 * 2. Merge duplicate JSON-LD conservatively — never overwrite non-empty with empty
 * 3. Extract rich specification sections from product description
 *
 * El Badr uses OpenCart 3 + Journal 3 with duplicate JSON-LD Product blocks.
 * The first JSON-LD Product has model/mpn fields; the second has a different description format.
 */
export function parseProductPage(html: string): ProductParseResult {
  const $ = cheerio.load(html);

  const { product, breadcrumbs } = extractJsonLdProductConservative($);
  const openCartProductId = extractOpenCartProductId($);
  const visibleTitle = extractVisibleTitle($);
  const visibleModel = extractVisibleModel($);
  const visibleMpn = extractVisibleMpn($);
  const visibleStock = extractVisibleStock($);
  const specifications = extractSpecifications($);

  return {
    product,
    breadcrumbs,
    openCartProductId,
    visibleTitle,
    visibleModel,
    visibleMpn,
    visibleStock,
    specifications,
  };
}

/**
 * Extract Product from multiple JSON-LD blocks, merging conservatively.
 * Never overwrite a non-empty field with an empty one.
 */
function extractJsonLdProductConservative($: ReturnType<typeof cheerio.load>): {
  product: ElBadrJsonLdProduct | null;
  breadcrumbs: Array<{ label: string; href: string }>;
} {
  const scripts = $('script[type="application/ld+json"]');
  let mergedProduct: ElBadrJsonLdProduct | null = null;
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
          const candidate = node as unknown as ElBadrJsonLdProduct;
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

function mergeProductFields(target: ElBadrJsonLdProduct, source: ElBadrJsonLdProduct): void {
  // Only merge if target field is empty/null/undefined and source has a value
  if (!target.model && source.model) target.model = source.model;
  if (!target.mpn && source.mpn) target.mpn = source.mpn;
  if (!target.sku && source.sku) target.sku = source.sku;
  if (!target.manufacturer && source.manufacturer) target.manufacturer = source.manufacturer;
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
    itemListElement: Array<{ position: number; item: { name: string; '@id': string } }>;
  },
): Array<{ label: string; href: string }> {
  return breadcrumbNode.itemListElement
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      label: item.item.name,
      href: item.item['@id'],
    }));
}

/**
 * Extract OpenCart product ID from hidden input or data attribute.
 * This is the internal OpenCart product ID, NOT the manufacturer MPN.
 */
function extractOpenCartProductId($: ReturnType<typeof cheerio.load>): string | null {
  // From hidden input with id="product-id": <input id="product-id" name="product_id" value="7543">
  // This is the main product's ID, not related product IDs.
  const mainInputVal = $('#product-id').attr('value');
  if (mainInputVal) return mainInputVal;

  // From data attribute on product-layout (product detail pages have exactly one)
  const dataVal = $('div.product-layout[data-product-id]').attr('data-product-id');
  if (dataVal) return dataVal;

  // From body class: class contains "product-7543"
  const bodyClass = $('body').attr('class') ?? '';
  const bodyMatch = bodyClass.match(/\bproduct-(\d+)\b/);
  if (bodyMatch?.[1]) return bodyMatch[1];

  // From gtag data in script
  const scripts = $('script');
  for (let i = 0; i < scripts.length; i++) {
    const text = $(scripts[i]).html() ?? '';
    const match = text.match(/"item_id"\s*:\s*"(\d+)"/);
    if (match?.[1]) return match[1];
  }

  return null;
}

function extractVisibleTitle($: ReturnType<typeof cheerio.load>): string | null {
  // Journal 3 uses div.title.page-title for the product title
  const title = $('div.title.page-title').text().trim();
  if (title) return title;

  // Fallback to h1
  const h1 = $('h1').text().trim();
  return h1 || null;
}

function extractVisibleModel($: ReturnType<typeof cheerio.load>): string | null {
  // El Badr shows: <li class="product-model"><b>Model:</b> <span>...</span></li>
  const modelSpan = $('li.product-model span').text().trim();
  return modelSpan || null;
}

function extractVisibleMpn($: ReturnType<typeof cheerio.load>): string | null {
  // El Badr shows: <li class="product-mpn"><b>MPN:</b> <span>...</span></li>
  const mpnSpan = $('li.product-mpn span').text().trim();
  return mpnSpan || null;
}

function extractVisibleStock($: ReturnType<typeof cheerio.load>): string | null {
  // El Badr shows: <li class="product-stock in-stock"><b>Stock:</b> <span>In Stock</span></li>
  const stockSpan = $('li.product-stock span').text().trim();
  return stockSpan || null;
}

/**
 * Extract specifications from the product description.
 * El Badr uses rich HTML descriptions with structured sections.
 *
 * Two known formats:
 * 1. Qwen-markdown format: `span.qwen-markdown-strong` for labels + `span.qwen-markdown-text` for values inside `li` elements
 * 2. Colon-separated list items: `<li>Label: Value</li>`
 * 3. Bold label + sibling text: `<strong>Label</strong> Value`
 */
function extractSpecifications($: ReturnType<typeof cheerio.load>): ProductSpecification[] {
  const specs: ProductSpecification[] = [];
  const seen = new Set<string>();

  function addSpec(label: string, value: string): void {
    const trimmedLabel = label.trim();
    const trimmedValue = value.trim();
    if (!trimmedLabel || !trimmedValue) return;
    if (trimmedLabel.length > 80) return; // skip overly long labels
    const key = `${trimmedLabel}=${trimmedValue}`;
    if (seen.has(key)) return;
    seen.add(key);
    specs.push({ label: trimmedLabel, value: trimmedValue });
  }

  // Source 1: Qwen-markdown format — description sections with structured list items
  // Pattern: <span class="qwen-markdown-strong">Label</span><span class="qwen-markdown-text">: Value</span>
  const descriptionEl = $('.block-content .qwen-markdown-list, .product_extra .qwen-markdown-list');
  if (descriptionEl.length > 0) {
    descriptionEl.find('li').each((_, el) => {
      const strongText = $(el).find('span.qwen-markdown-strong').text().trim();
      if (!strongText) return;
      // The text sibling contains ": Value"
      const fullText = $(el).text().trim();
      // Remove the label from the full text to get the value
      const valuePart = fullText.substring(strongText.length).replace(/^[:\s]+/, '');
      if (valuePart) {
        addSpec(strongText, valuePart);
      }
    });
  }

  // Source 2: Description content with structured sections (tab-description style)
  const descriptionElTab = $('#tab-description, .product_extra .block-content');
  if (descriptionElTab.length > 0) {
    // Extract from structured list items with colon patterns
    descriptionElTab.find('li').each((_, el) => {
      const text = $(el).text().trim();
      const colonMatch = text.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch?.[1] && colonMatch[2]) {
        addSpec(colonMatch[1], colonMatch[2]);
      }
    });

    // Also extract from strong/bold labels followed by text
    descriptionElTab.find('strong, b').each((_, el) => {
      const labelText = $(el).text().trim();
      if (!labelText || labelText.length > 80) return;
      const nextText = $(el).next().text().trim();
      if (nextText && nextText !== labelText && !nextText.startsWith(':')) {
        addSpec(labelText, nextText);
      }
    });
  }

  // Source 3: Product attribute tables (if any)
  $('table.table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 2) {
      const label = $(cells[0]).text().trim();
      const value = $(cells[1]).text().trim();
      addSpec(label, value);
    }
  });

  return specs;
}
