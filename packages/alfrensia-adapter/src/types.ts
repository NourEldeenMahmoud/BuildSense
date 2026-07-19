/**
 * Internal types for the Alfrensia adapter.
 */

export interface AlfrensiaJsonLdProduct {
  '@type': 'Product';
  name: string;
  url: string;
  description?: string;
  image?: string | string[];
  sku?: string;
  mpn?: string;
  gtin?: string;
  brand?: { '@type': 'Brand'; name: string } | string;
  offers?: AlfrensiaJsonLdOffer | AlfrensiaJsonLdOffer[];
}

export interface AlfrensiaJsonLdOffer {
  '@type': 'Offer' | 'AggregateOffer';
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
  url?: string;
}

export interface AlfrensiaJsonLdBreadcrumb {
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    position: number;
    item: { name: string; '@id': string };
  }>;
}

export interface AlfrensiaJsonLdGraph {
  '@graph': Array<
    | AlfrensiaJsonLdProduct
    | AlfrensiaJsonLdBreadcrumb
    | Record<string, unknown>
  >;
}

export interface AlfrensiaCategoryProduct {
  externalId: string | null;
  canonicalUrl: string;
  name: string;
  sku: string | null;
  priceText: string | null;
  oldPriceText: string | null;
  availabilityText: string | null;
  brandName: string | null;
  thumbnailUrl: string | null;
  isStock: boolean | null;
}
