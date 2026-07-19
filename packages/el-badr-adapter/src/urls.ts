const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
  'source',
]);

export function canonicalizeElBadrUrl(url: URL): string {
  const canonical = new URL(url.origin + url.pathname);
  for (const [key, value] of url.searchParams.entries()) {
    if (!TRACKING_PARAMS.has(key)) {
      canonical.searchParams.set(key, value);
    }
  }
  return canonical.href;
}

/**
 * El Badr uses clean product URLs like /product-slug — no /product/ prefix.
 * Product URLs are on the store host and have a single-segment path that is not
 * a known category or system path.
 */
export function isElBadrProductUrl(url: URL, elBadrHost: string): boolean {
  if (url.hostname !== elBadrHost) return false;
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '' || path === '/') return false;
  // Exclude known non-product paths
  const segments = path.split('/').filter(Boolean);
  if (segments.length !== 1) return false;
  const excluded = new Set(['index.php', 'admin', 'catalog', 'image', 'system', 'extension']);
  return !excluded.has(segments[0]!);
}

/**
 * El Badr category URLs are clean like /cpu, /gpu, etc.
 * or OpenCart style /index.php?route=product/category&path=107_20
 */
export function isElBadrCategoryUrl(url: URL, elBadrHost: string): boolean {
  if (url.hostname !== elBadrHost) return false;
  // OpenCart category URL
  if (url.searchParams.has('route') && url.searchParams.get('route') === 'product/category') {
    return true;
  }
  return false;
}

export function extractElBadrCategoryPath(url: URL): string | null {
  // OpenCart style: path=107_20
  const path = url.searchParams.get('path');
  if (path) return path;
  return null;
}

export function extractProductSlugFromUrl(url: URL): string | null {
  const path = url.pathname.replace(/\/+$/, '');
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 1) return segments[0]!;
  return null;
}

export function buildElBadrCategoryUrl(
  baseUrl: string,
  categoryPath: string,
): string {
  const url = new URL(categoryPath, baseUrl);
  return url.href;
}

export function buildElBadrProductUrl(baseUrl: string, productSlug: string): string {
  return new URL(`/${productSlug}/`, baseUrl).href;
}
