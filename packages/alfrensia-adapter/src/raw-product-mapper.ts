import type { RawProductSnapshot } from '@buildsense/contracts';
import type { AlfrensiaJsonLdProduct } from './types.js';
import { normalizeExternalId } from './identity.js';

type RawFields = RawProductSnapshot['raw'];

export interface AlfrensiaProductPageData {
  product: AlfrensiaJsonLdProduct | null;
  wordpressPostId: string | null;
  visibleTitle: string | null;
  mpn: string | null;
  gtin: string | null;
  visibleStock: string | null;
  breadcrumbs: Array<{ label: string; href: string }>;
  specifications: Array<{ label: string; value: string }>;
  /** Adapter-level category hint from seed config, e.g. 'monitor'. Injected into raw breadcrumbs for downstream category evidence. */
  categoryHint?: string | undefined;
}

/**
 * Map parsed Alfrensia product data to the RawProductSnapshot.raw shape.
 *
 * Precedence:
 * 1. JSON-LD corroboration for brand, MPN, GTIN, price, availability
 * 2. WordPress post ID as externalId (store-scoped internal ID)
 * 3. WooCommerce product attributes for specifications
 *
 * Rules:
 * - Single fixed EGP price only; no estimates/ranges
 * - Explicit availability wording
 * - Preserve raw specification section/label/value; no normalization/translation
 * - Manufacturer MPN from JSON-LD, NOT from WordPress post ID
 */
export function mapAlfrensiaProductToRaw(data: AlfrensiaProductPageData): {
  externalId: string | null;
  raw: RawFields;
  warnings: string[];
} {
  const warnings: string[] = [];
  const {
    product,
    wordpressPostId,
    visibleTitle,
    mpn,
    gtin,
    visibleStock,
    breadcrumbs,
    specifications,
    categoryHint,
  } = data;

  // External ID: stable WordPress product ID
  const externalId = normalizeExternalId(wordpressPostId);
  if (externalId === null && wordpressPostId != null) {
    warnings.push(`INVALID_EXTERNAL_ID: ${wordpressPostId}`);
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

  // Price: from JSON-LD offers
  let priceText: string | null = null;
  if (product?.offers) {
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    if (offer?.price != null) {
      const priceNum = typeof offer.price === 'string' ? parseFloat(offer.price) : offer.price;
      if (Number.isFinite(priceNum) && priceNum > 0) {
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

  // MPN: from JSON-LD (explicit mpn field)
  const partNumberText = mpn ?? product?.mpn ?? null;

  // GTIN: from JSON-LD (explicit gtin field)
  const skuText = gtin ?? product?.gtin ?? product?.sku ?? null;

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
  // so downstream publisher/consumer can confirm category from raw snapshot.
  // Alfrensia product pages have limited breadcrumbs (Home > Shop > Product Name),
  // so we rely on the categoryHint for actual category evidence.
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
    modelText: null, // Model not explicitly available on Alfrensia
    partNumberText,
    breadcrumbs: rawBreadcrumbs,
    specifications,
    imageUrls,
    descriptionText: product?.description ?? null,
  };

  return { externalId, raw, warnings };
}
