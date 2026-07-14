const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
  'source',
]);

export function canonicalizeSigmaUrl(url: URL): string {
  const canonical = new URL(url.origin + url.pathname);
  for (const [key, value] of url.searchParams.entries()) {
    if (!TRACKING_PARAMS.has(key)) {
      canonical.searchParams.set(key, value);
    }
  }
  return canonical.href;
}

export function isSigmaProductUrl(url: URL, sigmaHost: string): boolean {
  return url.hostname === sigmaHost && url.pathname === '/en/item' && url.searchParams.has('id');
}

export function isSigmaCategoryUrl(url: URL, sigmaHost: string): boolean {
  return url.hostname === sigmaHost && url.pathname.startsWith('/en/category/');
}

export function extractSigmaCategoryId(url: URL): string | null {
  const match = url.pathname.match(/\/en\/category\/([a-f0-9-]+)/i);
  return match?.[1] ?? null;
}

export function extractProductSlugFromUrl(url: URL): string | null {
  if (!url.searchParams.has('id')) return null;
  const id = url.searchParams.get('id')!;
  const parts = id.split('-');
  if (parts.length < 2) return null;
  return id;
}

export function buildSigmaCategoryUrl(
  baseUrl: string,
  sigmaCategoryId: string,
  page?: number,
): string {
  const url = new URL(`/en/category/${sigmaCategoryId}`, baseUrl);
  if (page && page > 1) {
    url.searchParams.set('page', String(page));
  }
  return url.href;
}

export function buildSigmaProductUrl(baseUrl: string, productSlug: string): string {
  const url = new URL('/en/item', baseUrl);
  url.searchParams.set('id', productSlug);
  return url.href;
}

export function hashUrlForFilename(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}
