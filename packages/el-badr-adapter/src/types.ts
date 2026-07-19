/**
 * Internal types for the El Badr Group adapter.
 */

export interface ElBadrJsonLdProduct {
  '@type': 'Product';
  name: string;
  url: string;
  description?: string;
  image?: string | string[];
  sku?: string;
  model?: string;
  mpn?: string;
  manufacturer?: string;
  brand?: { '@type': 'Brand'; name: string } | string;
  offers?: ElBadrJsonLdOffer | ElBadrJsonLdOffer[];
}

export interface ElBadrJsonLdOffer {
  '@type': 'Offer' | 'AggregateOffer';
  name?: string;
  price?: string | number;
  priceCurrency?: string;
  priceValidUntil?: string;
  itemCondition?: string;
  availability?: string;
  url?: string;
  seller?: { '@type': 'Organization'; name: string };
  priceSpecification?: Array<{
    '@type': 'UnitPriceSpecification';
    price?: string | number;
    priceCurrency?: string;
  }>;
  offers?: ElBadrJsonLdOffer[];
}

export interface ElBadrJsonLdBreadcrumb {
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    position: number;
    item: { name: string; '@id': string };
  }>;
}

export interface ElBadrJsonLdGraph {
  '@graph': Array<
    | ElBadrJsonLdProduct
    | ElBadrJsonLdBreadcrumb
    | Record<string, unknown>
  >;
}

export interface ElBadrCategoryProduct {
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
