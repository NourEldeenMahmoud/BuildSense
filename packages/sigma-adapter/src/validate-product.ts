import type {
  SigmaBrand,
  SigmaCategoryProduct,
  SigmaCategoryRef,
  SigmaImage,
  SigmaPrice,
  SigmaProduct,
  SigmaSpecification,
} from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isSigmaPrice(value: unknown): value is SigmaPrice {
  return (
    isRecord(value) &&
    typeof value['base'] === 'number' &&
    typeof value['current'] === 'number' &&
    typeof value['discount_percentage'] === 'number' &&
    typeof value['currency'] === 'string'
  );
}

function isSigmaImage(value: unknown): value is SigmaImage {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['url'] === 'string' &&
    typeof value['type'] === 'string'
  );
}

function isSigmaCategory(value: unknown): value is SigmaCategoryRef {
  if (!isRecord(value)) return false;

  const parent = value['parent_category'];
  return (
    typeof value['id'] === 'string' &&
    typeof value['slug'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['is_subcategory'] === 'boolean' &&
    (parent === undefined || isSigmaCategory(parent))
  );
}

function isSigmaBrand(value: unknown): value is SigmaBrand {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['slug'] === 'string' &&
    (value['image'] === null || isSigmaImage(value['image'])) &&
    typeof value['is_featured'] === 'boolean'
  );
}

function isSigmaSpecification(value: unknown): value is SigmaSpecification {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['order'] === 'number' &&
    typeof value['priority'] === 'number' &&
    typeof value['value'] === 'string' &&
    isStringArray(value['meta'])
  );
}

export function isSigmaCategoryProduct(value: unknown): value is SigmaCategoryProduct {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['slug'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['sku'] === 'string' &&
    isSigmaPrice(value['price']) &&
    isSigmaImage(value['thumbnail']) &&
    isSigmaCategory(value['category']) &&
    (value['brand'] === null || isSigmaBrand(value['brand'])) &&
    typeof value['is_stock'] === 'boolean' &&
    typeof value['is_discount'] === 'boolean'
  );
}

function hasProductIdentity(product: Record<string, unknown>): boolean {
  return (
    typeof product['id'] === 'string' &&
    typeof product['slug'] === 'string' &&
    typeof product['name'] === 'string' &&
    typeof product['sku'] === 'string' &&
    isNullableString(product['description']) &&
    isStringArray(product['tags']) &&
    (typeof product['points'] === 'number' || product['points'] === null) &&
    isNullableString(product['barcode'])
  );
}

function hasProductMetrics(product: Record<string, unknown>): boolean {
  const views = product['views'];
  const review = product['review'];
  return (
    isRecord(views) &&
    typeof views['total'] === 'number' &&
    typeof views['unique'] === 'number' &&
    typeof views['live'] === 'number' &&
    isRecord(review) &&
    isNullableString(review['stars']) &&
    typeof review['total'] === 'number'
  );
}

function hasProductCommerce(product: Record<string, unknown>): boolean {
  return (
    isSigmaPrice(product['price']) &&
    isSigmaImage(product['thumbnail']) &&
    Array.isArray(product['media']) &&
    product['media'].every(isSigmaImage) &&
    typeof product['minimum_order_count'] === 'number' &&
    typeof product['maximum_order_count'] === 'number' &&
    isNullableString(product['warranty']) &&
    isNullableString(product['seller_notes']) &&
    isNullableString(product['return_policy'])
  );
}

function hasProductRelations(product: Record<string, unknown>): boolean {
  return (
    'seller' in product &&
    isSigmaCategory(product['category']) &&
    (product['brand'] === null || isSigmaBrand(product['brand'])) &&
    'vendor' in product &&
    Array.isArray(product['specifications']) &&
    product['specifications'].every(isSigmaSpecification) &&
    'variant_attributes' in product &&
    Array.isArray(product['sub_products'])
  );
}

function hasProductFlags(product: Record<string, unknown>): boolean {
  return [
    'is_discount',
    'is_wishlist',
    'is_stock',
    'is_best_seller',
    'is_featured',
    'is_sub_product',
    'is_free_shipping',
  ].every((key) => typeof product[key] === 'boolean');
}

export function isSigmaProduct(value: unknown): value is SigmaProduct {
  return (
    isRecord(value) &&
    hasProductIdentity(value) &&
    hasProductMetrics(value) &&
    hasProductCommerce(value) &&
    hasProductRelations(value) &&
    hasProductFlags(value)
  );
}
