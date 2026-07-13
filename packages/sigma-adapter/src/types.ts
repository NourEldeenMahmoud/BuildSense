export interface SigmaPrice {
  base: number;
  current: number;
  discount_percentage: number;
  currency: string;
}

export interface SigmaCategoryPrice {
  base: number | null;
  current: number;
  discount_percentage: number | null;
  currency: string | null;
}

export interface SigmaImage {
  id: string;
  url: string;
  type: string;
}

export interface SigmaCategoryRef {
  id: string;
  slug: string;
  name: string;
  is_subcategory: boolean;
  parent_category?: SigmaCategoryRef;
}

export interface SigmaBrand {
  id: string;
  name: string;
  slug: string;
  image: SigmaImage | null;
  is_featured: boolean;
}

export interface SigmaSpecification {
  id: string;
  name: string;
  order: number;
  priority: number;
  value: string;
  meta: string[];
}

export interface SigmaProduct {
  id: string;
  slug: string;
  name: string;
  sku: string;
  description: string | null;
  tags: string[];
  points: number | null;
  barcode: string | null;
  views: { total: number; unique: number; live: number };
  review: { stars: string | null; total: number };
  price: SigmaPrice;
  thumbnail: SigmaImage;
  media: SigmaImage[];
  minimum_order_count: number;
  maximum_order_count: number;
  warranty: string | null;
  seller_notes: string | null;
  return_policy: string | null;
  seller: unknown;
  category: SigmaCategoryRef;
  brand: SigmaBrand | null;
  vendor: unknown;
  specifications: SigmaSpecification[];
  is_discount: boolean;
  is_wishlist: boolean;
  is_stock: boolean;
  is_best_seller: boolean;
  is_featured: boolean;
  is_sub_product: boolean;
  variant_attributes: unknown;
  sub_products: unknown[];
  is_free_shipping: boolean;
}

export interface SigmaCategoryProduct {
  id: string | null;
  slug: string;
  name: string;
  sku: string | null;
  price: SigmaCategoryPrice;
  thumbnail: SigmaImage | null;
  category: SigmaCategoryRef | null;
  brand: SigmaBrand | null;
  is_stock: boolean | null;
  is_discount: boolean | null;
}

export interface SigmaPagination {
  totalItems: number;
  perPage: number;
  isNext: boolean;
  isPrevious: boolean;
}

export interface CategoryParseResult {
  products: SigmaCategoryProduct[];
  pagination: SigmaPagination;
  breadcrumb: Array<{ level: number; label: string; href: string }>;
}

export interface ProductParseResult {
  product: SigmaProduct;
  breadcrumb: Array<{ level: number; label: string; href: string }>;
}
