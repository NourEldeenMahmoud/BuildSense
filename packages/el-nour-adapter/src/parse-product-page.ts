import * as cheerio from 'cheerio';
import type { ElNourJsonLdProduct, ElNourProductVariation } from './types.js';

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductParseResult {
  product: ElNourJsonLdProduct | null;
  breadcrumbs: Array<{ label: string; href: string }>;
  wooProductId: string | null;
  sku: string | null;
  variations: ElNourProductVariation[];
  isVariable: boolean;
  specifications: ProductSpecification[];
}

/**
 * Parse an El Nour Tech product page HTML.
 *
 * Strategy:
 * 1. Extract the second `application/ld+json` block (WooCommerce Product JSON-LD).
 * 2. Extract breadcrumbs from the same JSON-LD block.
 * 3. Extract WooCommerce product ID from body class `postid-{id}`.
 * 4. Extract SKU from JSON-LD or product meta.
 * 5. For variable products, extract variations from `data-product_variations`.
 */
export function parseProductPage(html: string): ProductParseResult {
  const $ = cheerio.load(html);

  const { product, breadcrumbs } = extractJsonLdProduct($);
  const wooProductId = extractWooProductId($);
  const sku = extractSku($, product);
  const { variations, isVariable } = extractVariations($);
  const specifications = extractSpecifications($, product);

  return {
    product,
    breadcrumbs,
    wooProductId,
    sku,
    variations,
    isVariable,
    specifications,
  };
}

function extractJsonLdProduct($: ReturnType<typeof cheerio.load>): {
  product: ElNourJsonLdProduct | null;
  breadcrumbs: Array<{ label: string; href: string }>;
} {
  const scripts = $('script[type="application/ld+json"]');

  // Walk all JSON-LD blocks and find the one with Product type
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;

      // Handle both direct and @graph wrapped structures
      const graph = extractGraph(parsed);
      if (!graph) continue;

      let product: ElNourJsonLdProduct | null = null;
      let breadcrumbs: Array<{ label: string; href: string }> = [];

      for (const node of graph) {
        if (node['@type'] === 'Product') {
          product = node as unknown as ElNourJsonLdProduct;
        }
        if (node['@type'] === 'BreadcrumbList' && 'itemListElement' in node) {
          breadcrumbs = extractBreadcrumbs(
            node as { itemListElement: Array<{ position: number; item: { name: string; '@id': string } }> },
          );
        }
      }

        if (product) {
          return { product: product as ElNourJsonLdProduct, breadcrumbs };
        }
    } catch {
      // Skip malformed JSON-LD blocks
    }
  }

  return { product: null, breadcrumbs: [] };
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

function extractWooProductId($: ReturnType<typeof cheerio.load>): string | null {
  const bodyClass = $('body').attr('class') ?? '';
  const match = bodyClass.match(/postid-(\d+)/);
  return match?.[1] ?? null;
}

function extractSku(
  $: ReturnType<typeof cheerio.load>,
  product: ElNourJsonLdProduct | null,
): string | null {
  // Try JSON-LD first
  if (product?.sku) return product.sku;

  // Try WooCommerce SKU element
  const wooSku = $('span.sku').text().trim();
  if (wooSku) return wooSku;

  // Try product_meta
  const metaSku = $('div.wd-single-meta .wd-product-meta-sku').text().trim();
  if (metaSku) return metaSku;

  return null;
}

function extractVariations($: ReturnType<typeof cheerio.load>): {
  variations: ElNourProductVariation[];
  isVariable: boolean;
} {
  const form = $('form.variations_form');
  if (form.length === 0) {
    return { variations: [], isVariable: false };
  }

  const variationsJson = form.attr('data-product_variations');
  if (!variationsJson) {
    return { variations: [], isVariable: true };
  }

  try {
    const parsed: unknown = JSON.parse(variationsJson);
    if (!Array.isArray(parsed)) {
      return { variations: [], isVariable: true };
    }

    const variations: ElNourProductVariation[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        'display_price' in item
      ) {
          const v = item as Record<string, unknown>;
          const variationImage = v['image'] as
            | { src: string; title: string; alt: string }
            | undefined;
          variations.push({
            attributes: (v['attributes'] as Record<string, string>) ?? {},
            display_price: v['display_price'] as number,
            display_regular_price: (v['display_regular_price'] as number) ?? (v['display_price'] as number),
            availability_html: (v['availability_html'] as string) ?? '',
            ...(variationImage != null ? { image: variationImage } : {}),
          });
      }
    }

    return { variations, isVariable: true };
  } catch {
    return { variations: [], isVariable: true };
  }
}

/**
 * Extract specifications from two sources:
 * 1. WooCommerce attribute table rows (stable, primary)
 * 2. Clearly structured description label/value pairs (secondary)
 *
 * Preserves original labels/values and mixed language.
 * Deduplicates exact label+value pairs only.
 */
function extractSpecifications(
  $: ReturnType<typeof cheerio.load>,
  product: ElNourJsonLdProduct | null,
): ProductSpecification[] {
  const specs: ProductSpecification[] = [];
  const seen = new Set<string>();

  function addSpec(label: string, value: string): void {
    const trimmedLabel = label.trim();
    const trimmedValue = value.trim();
    if (!trimmedLabel || !trimmedValue) return;
    const key = `${trimmedLabel}=${trimmedValue}`;
    if (seen.has(key)) return;
    seen.add(key);
    specs.push({ label: trimmedLabel, value: trimmedValue });
  }

  // Source 1: WooCommerce attribute table
  $('table.woocommerce-product-attributes tr.woocommerce-product-attributes-item').each(
    (_, row) => {
      const label = $(row).find('.wd-attr-name').text().trim();
      const value = $(row).find('.wd-term-name').text().trim();
      if (label && value) {
        addSpec(label, value);
      }
    },
  );

  // Source 2: Structured description label/value pairs
  if (product?.description) {
    const descSpecs = extractDescriptionSpecs(product.description);
    for (const s of descSpecs) {
      addSpec(s.label, s.value);
    }
  }

  return specs;
}

/**
 * Extract structured label/value pairs from a product description string.
 *
 * Recognizes two patterns:
 * - Alternating key/value lines (e.g. "# of CPU Cores\n6")
 * - Tab-indented lines with concatenated label+value (e.g. "\tTotal Cores6")
 *
 * Does NOT normalize, translate, or merge.
 */
function extractDescriptionSpecs(description: string): ProductSpecification[] {
  const specs: ProductSpecification[] = [];

  // Normalize line endings and split
  const lines = description.split(/\r?\n/).map((l) => l.trim());

  // Pattern 1: Tab-indented lines (space/tab prefix, then content)
  // These look like: " \tLabel Value" or "\tLabel Value"
  const tabIndented = lines.filter((l) => /^\s\t/.test(l));
  if (tabIndented.length > 2) {
    for (const line of tabIndented) {
      // Remove leading whitespace and tab, then split on first multi-space or tab
      const content = line.replace(/^\s+\t/, '');
      // Try splitting on tab first
      const tabSplit = content.split('\t');
      if (tabSplit.length >= 2 && tabSplit[0]!.trim() && tabSplit[1]!.trim()) {
        specs.push({ label: tabSplit[0]!.trim(), value: tabSplit.slice(1).join('\t').trim() });
        continue;
      }
      // Try splitting on two or more consecutive spaces
      const spaceSplit = content.split(/\s{2,}/);
      if (spaceSplit.length >= 2 && spaceSplit[0]!.trim() && spaceSplit[1]!.trim()) {
        specs.push({ label: spaceSplit[0]!.trim(), value: spaceSplit.slice(1).join(' ').trim() });
      }
    }
    if (specs.length > 0) return specs;
  }

  // Pattern 2: Alternating key/value lines (non-tab-indented)
  // Filter to non-empty lines only
  const nonEmpty = lines.filter((l) => l.length > 0);
  if (nonEmpty.length >= 4 && nonEmpty.length % 2 === 0) {
    let isAlternating = true;
    for (let i = 0; i < nonEmpty.length; i += 2) {
      const key = nonEmpty[i]!;
      const val = nonEmpty[i + 1]!;
      // Keys should not be purely numeric, values can be short
      if (/^\d+$/.test(key) || key.length > 100 || val.length > 200) {
        isAlternating = false;
        break;
      }
    }
    if (isAlternating) {
      for (let i = 0; i < nonEmpty.length; i += 2) {
        specs.push({ label: nonEmpty[i]!, value: nonEmpty[i + 1]! });
      }
    }
  }

  return specs;
}
