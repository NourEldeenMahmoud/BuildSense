import type { RawProductSnapshot } from '@buildsense/contracts';
import type { ElBadrJsonLdProduct } from './types.js';
import { normalizeExternalId } from './identity.js';
import { parseEgpPrice } from './parse-egp-price.js';

type RawFields = RawProductSnapshot['raw'];

export interface ElBadrProductPageData {
  product: ElBadrJsonLdProduct | null;
  openCartProductId: string | null;
  visibleTitle: string | null;
  visibleModel: string | null;
  visibleMpn: string | null;
  visibleStock: string | null;
  breadcrumbs: Array<{ label: string; href: string }>;
  specifications: Array<{ label: string; value: string }>;
  /** Adapter-level category hint from seed config, e.g. 'cpu'. Injected into raw breadcrumbs for downstream category evidence. */
  categoryHint?: string | undefined;
}

/**
 * Map parsed El Badr product data to the RawProductSnapshot.raw shape.
 *
 * Precedence:
 * 1. Visible HTML elements: title, price, stock, model, MPN
 * 2. JSON-LD corroboration (never overwrite non-empty with empty)
 * 3. OpenCart product ID as externalId (store-scoped internal ID)
 *
 * Rules:
 * - Single fixed EGP price only; no estimates/ranges
 * - Explicit availability wording
 * - Preserve raw specification section/label/value; no normalization/translation
 * - Manufacturer MPN only from visible MPN evidence, not internal OpenCart product ID
 */
export function mapElBadrProductToRaw(data: ElBadrProductPageData): {
  externalId: string | null;
  raw: RawFields;
  warnings: string[];
} {
  const warnings: string[] = [];
  const {
    product,
    openCartProductId,
    visibleTitle,
    visibleModel,
    visibleMpn,
    visibleStock,
    breadcrumbs,
    specifications,
    categoryHint,
  } = data;

  // External ID: stable internal product ID (OpenCart product_id)
  const externalId = normalizeExternalId(openCartProductId);
  if (externalId === null && openCartProductId != null) {
    warnings.push(`INVALID_EXTERNAL_ID: ${openCartProductId}`);
  }

  // Title: prefer visible, fall back to JSON-LD
  let title = visibleTitle ?? null;
  if (!title && product?.name) {
    title = product.name;
  }

  // Brand: from JSON-LD
  let brandText: string | null = null;
  if (product?.brand != null) {
    if (typeof product.brand === 'string') {
      brandText = product.brand;
    } else {
      brandText = product.brand.name ?? null;
    }
  }
  // Also try manufacturer field
  if (!brandText && product?.manufacturer) {
    brandText = product.manufacturer;
  }

  // Price: from JSON-LD offers (visible price is in the HTML but JSON-LD is more reliable for numeric)
  let priceText: string | null = null;
  if (product?.offers) {
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    if (offer?.price != null) {
      const priceNum = typeof offer.price === 'string' ? parseEgpPrice(offer.price) : offer.price;
      if (priceNum != null) {
        priceText = String(priceNum);
      }
    }
  }

  // Availability: prefer visible stock text, fall back to JSON-LD
  let availabilityText: string | null = visibleStock ?? null;
  if (!availabilityText && product?.offers) {
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    if (offer?.availability != null) {
      // Convert schema.org URL to readable text
      const avail = String(offer.availability);
      if (avail.includes('InStock')) {
        availabilityText = 'In Stock';
      } else if (avail.includes('OutOfStock')) {
        availabilityText = 'Out of Stock';
      } else {
        availabilityText = avail;
      }
    }
  }

  // Model: prefer visible, fall back to JSON-LD
  const modelText = visibleModel ?? product?.model ?? null;

  // MPN: ONLY from visible MPN evidence, NOT from internal OpenCart product ID
  const partNumberText = visibleMpn ?? product?.mpn ?? null;

  // SKU: from JSON-LD
  const skuText = product?.sku ?? null;

  // Images: from JSON-LD
  const imageUrls: string[] = [];
  if (product?.image) {
    if (Array.isArray(product.image)) {
      imageUrls.push(...product.image.filter((url): url is string => typeof url === 'string'));
    } else if (typeof product.image === 'string') {
      imageUrls.push(product.image);
    }
  }

  // Build breadcrumbs: inject adapter-level category evidence at position 0
  // so downstream publisher/consumer can confirm category from raw snapshot,
  // not by title guessing. El Badr product pages often lack breadcrumb evidence.
  const rawBreadcrumbs: string[] = [];
  if (categoryHint) {
    rawBreadcrumbs.push(categoryHint.toUpperCase());
  }
  rawBreadcrumbs.push(...breadcrumbs.map((b) => b.label));

  const raw: RawFields = {
    title,
    priceText,
    oldPriceText: null,
    availabilityText,
    skuText,
    brandText,
    modelText,
    partNumberText,
    breadcrumbs: rawBreadcrumbs,
    specifications,
    imageUrls,
    descriptionText: product?.description ?? null,
  };

  return { externalId, raw, warnings };
}
