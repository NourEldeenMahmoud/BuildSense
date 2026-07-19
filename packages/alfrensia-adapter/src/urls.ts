const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
  'source',
]);

export function canonicalizeAlfrensiaUrl(url: URL): string {
  const canonical = new URL(url.origin + url.pathname);
  for (const [key, value] of url.searchParams.entries()) {
    if (!TRACKING_PARAMS.has(key)) {
      canonical.searchParams.set(key, value);
    }
  }
  return canonical.href;
}

/**
 * Alfrensia uses WordPress/WooCommerce with product URLs like /en/product/product-slug/
 */
export function isAlfrensiaProductUrl(url: URL, alfrensiaHost: string): boolean {
  if (url.hostname !== alfrensiaHost) return false;
  const path = url.pathname.replace(/\/+$/, '');
  // WordPress/WooCommerce product URLs: /en/product/product-slug/
  return /\/product\/[^/]+\/?$/.test(path);
}

/**
 * Alfrensia category URLs are like /en/product-category/monitors/
 */
export function isAlfrensiaCategoryUrl(url: URL, alfrensiaHost: string): boolean {
  if (url.hostname !== alfrensiaHost) return false;
  const path = url.pathname.replace(/\/+$/, '');
  return /\/product-category\/[^/]+\/?$/.test(path);
}

export function extractProductSlugFromUrl(url: URL): string | null {
  const path = url.pathname.replace(/\/+$/, '');
  const match = path.match(/\/product\/([^/]+)\/?$/);
  return match?.[1] ?? null;
}

export function buildAlfrensiaCategoryUrl(
  baseUrl: string,
  categoryPath: string,
): string {
  const url = new URL(categoryPath, baseUrl);
  return url.href;
}

export function buildAlfrensiaProductUrl(baseUrl: string, productSlug: string): string {
  return new URL(`/en/product/${productSlug}/`, baseUrl).href;
}
