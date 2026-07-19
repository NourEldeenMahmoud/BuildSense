/**
 * Internal types for the El Nour adapter.
 */

export interface ElNourJsonLdProduct {
  '@type': 'Product';
  name: string;
  url: string;
  description?: string;
  image?: string | string[];
  sku?: string;
  brand?: { '@type': 'Brand'; name: string } | string;
  offers?: ElNourJsonLdOffer | ElNourJsonLdOffer[];
}

export interface ElNourJsonLdOffer {
  '@type': 'Offer' | 'AggregateOffer';
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
  url?: string;
  priceSpecification?: Array<{
    '@type': 'UnitPriceSpecification';
    price?: string | number;
    priceCurrency?: string;
  }>;
  offers?: ElNourJsonLdOffer[];
}

export interface ElNourJsonLdBreadcrumb {
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    position: number;
    item: { name: string; '@id': string };
  }>;
}

export interface ElNourJsonLdGraph {
  '@graph': Array<
    | ElNourJsonLdProduct
    | ElNourJsonLdBreadcrumb
    | Record<string, unknown>
  >;
}

export interface ElNourCategoryProduct {
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

export interface ElNourProductVariation {
  attributes: Record<string, string>;
  display_price: number;
  display_regular_price: number;
  availability_html: string;
  image?: { src: string; title: string; alt: string } | undefined;
}
