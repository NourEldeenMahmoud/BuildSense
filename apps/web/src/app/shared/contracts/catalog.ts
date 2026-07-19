export interface PaginationData {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CatalogProductListItem {
  id: string;
  title: string;
  category: string;
  brand: string | null;
  model: string | null;
  mpn: string | null;
  images: string[];
  price: number | null;
  currency: string;
  availability: string;
  sourceUrl: string | null;
  createdAt: string;
  cardSpecifications?: Array<{ label: string; value: string }>;
}

export interface CatalogProductListResponse {
  items: CatalogProductListItem[];
  pagination: PaginationData;
}

export interface CatalogCategoryListResponse {
  items: string[];
}

export interface CatalogProductOffer {
  id: string;
  storeCode: string;
  price: number | null;
  currency: string;
  availability: string;
  sourceUrl: string | null;
}

export interface RawSpecification {
  label: string;
  value: string;
  _id?: string;
}

export interface CatalogProductDetail {
  id: string;
  title: string;
  category: string;
  brand: string | null;
  model: string | null;
  mpn: string | null;
  images: string[];
  rawSpecifications: RawSpecification[];
  compatibility: Record<string, unknown>;
  createdAt: string;
  offers: CatalogProductOffer[];
}
