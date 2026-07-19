const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
  'source',
]);

export function canonicalizeElNourUrl(url: URL): string {
  const canonical = new URL(url.origin + url.pathname);
  for (const [key, value] of url.searchParams.entries()) {
    if (!TRACKING_PARAMS.has(key)) {
      canonical.searchParams.set(key, value);
    }
  }
  return canonical.href;
}

export function isElNourProductUrl(url: URL, elNourHost: string): boolean {
  return (
    url.hostname === elNourHost &&
    url.pathname.includes('/product/') &&
    !url.pathname.includes('/product-category/')
  );
}

export function isElNourCategoryUrl(url: URL, elNourHost: string): boolean {
  return (
    url.hostname === elNourHost &&
    url.pathname.includes('/product-category/')
  );
}

export function extractElNourCategorySlug(url: URL): string | null {
  const match = url.pathname.match(/\/product-category\/([^/]+(?:\/[^/]+)*)\/?$/);
  return match?.[1] ?? null;
}

export function extractProductSlugFromUrl(url: URL): string | null {
  const match = url.pathname.match(/\/product\/([^/]+)\/?$/);
  return match?.[1] ?? null;
}

export function buildElNourCategoryUrl(
  baseUrl: string,
  categoryPath: string,
  page?: number,
): string {
  const url = new URL(`/product-category/${categoryPath}/`, baseUrl);
  if (page && page > 1) {
    url.searchParams.set('page', String(page));
  }
  return url.href;
}

export function buildElNourProductUrl(baseUrl: string, productSlug: string): string {
  return new URL(`/product/${productSlug}/`, baseUrl).href;
}

/**
 * Build the en-localized category URL for a given category path.
 */
export function buildElNourLocalizedCategoryUrl(
  baseUrl: string,
  categoryPath: string,
  page?: number,
): string {
  const url = new URL(`/en/product-category/${categoryPath}/`, baseUrl);
  if (page && page > 1) {
    url.pathname += `page/${page}/`;
  }
  return url.href;
}
