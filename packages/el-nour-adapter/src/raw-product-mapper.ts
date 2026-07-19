import type { RawProductSnapshot } from '@buildsense/contracts';
import type { ElNourJsonLdProduct, ElNourProductVariation } from './types.js';
import { normalizeExternalId } from './identity.js';

type RawFields = RawProductSnapshot['raw'];

export interface ElNourProductPageData {
  product: ElNourJsonLdProduct | null;
  wooProductId: string | null;
  sku: string | null;
  variations: ElNourProductVariation[];
  isVariable: boolean;
  breadcrumbs: Array<{ label: string; href: string }>;
  specifications: Array<{ label: string; value: string }>;
}

/**
 * Map parsed El Nour product data to the RawProductSnapshot.raw shape.
 */
export function mapElNourProductToRaw(data: ElNourProductPageData): {
  externalId: string | null;
  raw: RawFields;
  warnings: string[];
} {
  const warnings: string[] = [];
  const { product, wooProductId, sku, variations, isVariable, breadcrumbs, specifications } = data;

  // External ID is the WooCommerce product ID
  const externalId = normalizeExternalId(wooProductId);
  if (externalId === null && wooProductId != null) {
    warnings.push(`INVALID_EXTERNAL_ID: ${wooProductId}`);
  }

  // Extract brand
  let brandText: string | null = null;
  if (product?.brand != null) {
    if (typeof product.brand === 'string') {
      brandText = product.brand;
    } else {
      brandText = product.brand.name ?? null;
    }
  }

  // Extract price
  let priceText: string | null = null;
  let oldPriceText: string | null = null;

  if (isVariable && variations.length > 0) {
    // Variable products: do NOT publish a price — user must select a variant.
    priceText = null;
    warnings.push('VARIABLE_PRICE_REQUIRES_VARIANT_SELECTION');
  } else if (product?.offers) {
    // Simple product: extract from offers
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;

    // Guard: AggregateOffer with multiple sub-offers is variable-like — do not collapse
    if (offer?.offers && Array.isArray(offer.offers) && offer.offers.length > 1) {
      priceText = null;
      warnings.push('VARIABLE_PRICE_REQUIRES_VARIANT_SELECTION');
    } else if (offer?.offers && Array.isArray(offer.offers) && offer.offers.length === 1) {
      // Single sub-offer inside AggregateOffer — use that price
      const innerOffer = offer.offers[0];
      if (innerOffer?.price != null) {
        priceText = String(innerOffer.price);
      }
    }

    if (priceText == null && !warnings.includes('VARIABLE_PRICE_REQUIRES_VARIANT_SELECTION')) {
      // Try priceSpecification
      if (offer?.priceSpecification) {
        const spec = offer.priceSpecification[0];
        if (spec?.price != null) {
          priceText = String(spec.price);
        }
      }

      // Try direct price
      if (priceText == null && offer?.price != null) {
        priceText = String(offer.price);
      }

      // Detect sale price for simple products
      if (priceText != null && offer?.priceSpecification) {
        const spec = offer.priceSpecification[0];
        if (spec?.price != null) {
          const regularPrice = Number(spec.price);
          const salePrice = Number(priceText);
          if (regularPrice > salePrice) {
            oldPriceText = String(regularPrice);
          }
        }
      }
    }
  }

  // Extract availability
  let availabilityText: string | null = null;
  if (product?.offers) {
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    if (offer?.availability != null) {
      availabilityText = String(offer.availability);
    }
  }

  // Extract images
  const imageUrls: string[] = [];
  if (product?.image) {
    if (Array.isArray(product.image)) {
      imageUrls.push(...product.image.filter((url): url is string => typeof url === 'string'));
    } else if (typeof product.image === 'string') {
      imageUrls.push(product.image);
    }
  }

  const raw: RawFields = {
    title: product?.name ?? null,
    priceText,
    oldPriceText,
    availabilityText,
    skuText: sku ?? product?.sku ?? null,
    brandText,
    modelText: null,
    partNumberText: null, // Store SKU is NOT manufacturer MPN — never promote
    breadcrumbs: breadcrumbs.map((b) => b.label),
    specifications,
    imageUrls,
    descriptionText: product?.description ?? null,
  };

  return { externalId, raw, warnings };
}
