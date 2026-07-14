#!/usr/bin/env node
/**
 * sigma-one-time-import.mjs
 *
 * One-time Sigma bootstrap dataset importer for BuildSense.
 *
 * Approach:
 *   1. Check robots.txt — abort if denied.
 *   2. For each enabled category seed (or a single --seed-id):
 *      a. Fetch page 1 → extract totalItems from RSC pagination.
 *      b. Compute expectedPages = ceil(totalItems / 16) upfront.
 *      c. Generate all page URLs upfront.
 *      d. Fetch every page sequentially with plain fetch() + retry.
 *      e. Collect all product slugs / canonical URLs.
 *   3. Deduplicate product URLs globally.
 *   4. For each unique product URL:
 *      - Resume: if a gzip snapshot exists on disk, re-parse from it.
 *      - Else: fetch → save gzip → parse.
 *      - On any failure: record error, continue (never silent skip).
 *   5. Export:
 *      - data/bootstrap/sigma-products.json
 *      - data/bootstrap/sigma-import-manifest.json
 *      - data/bootstrap/sigma-import-errors.json
 *
 * Usage:
 *   node scripts/sigma-one-time-import.mjs [--seed-id cpu] [--base-url https://...]
 *
 * Prerequisites:
 *   npx nx run sigma-adapter:build
 *   (scraping-core build not needed — robots evaluator is inlined here)
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SIGMA_ADAPTER_DIST = path.join(ROOT, 'packages', 'sigma-adapter', 'dist');
const OUTPUT_DIR = path.join(ROOT, 'data', 'bootstrap');
const SNAPSHOT_DIR = path.join(OUTPUT_DIR, 'snapshots');

// ─── Import sigma-adapter compiled modules ─────────────────────────────────

const {
  parseCategoryPage,
  parseProductPage,
  SIGMA_CATEGORY_SEEDS,
  buildSigmaCategoryUrl,
  buildSigmaProductUrl,
  canonicalizeSigmaUrl,
} = await import(pathToFileURL(path.join(SIGMA_ADAPTER_DIST, 'index.js')).href);

const { mapSigmaProductToRaw } = await import(
  pathToFileURL(path.join(SIGMA_ADAPTER_DIST, 'raw-product-mapper.js')).href
);

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const BASE_URL = getArg('--base-url') ?? 'https://www.sigma-computer.com';
const SEED_ID = getArg('--seed-id'); // undefined = all categories

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_AGENT = 'BuildSense/0.1.0 (github.com/NourEldeenMahmoud/BuildSense)';
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;
const PER_PAGE = 16;

// ─── Robots.txt check ─────────────────────────────────────────────────────────

async function checkRobots(baseUrl) {
  const robotsUrl = baseUrl.replace(/\/$/, '') + '/robots.txt';
  log('info', `Checking robots.txt at ${robotsUrl}`);

  try {
    const res = await fetchWithTimeout(robotsUrl, TIMEOUT_MS);
    if (res.status === 404) {
      log('info', 'robots.txt not found (404) — crawling allowed');
      return 'ALLOWED';
    }
    if (!res.ok) {
      log('warn', `robots.txt returned HTTP ${res.status} — failing closed`);
      return 'DENIED';
    }

    const text = await res.text();
    const denied = isDisallowed(text, USER_AGENT, ['/', '/en/', '/en/category/', '/en/item']);
    if (denied) {
      log('error', 'robots.txt disallows our user-agent for target paths');
      return 'DENIED';
    }
    log('info', 'robots.txt allows crawling');
    return 'ALLOWED';
  } catch (err) {
    log('warn', `robots.txt fetch failed: ${err.message} — failing closed`);
    return 'DENIED';
  }
}

function isDisallowed(text, userAgent, paths) {
  const lines = text.split(/\r?\n/);
  let inSection = false;
  let disallowedPaths = [];
  let allowedPaths = [];

  // Two-pass: collect wildcard section, then agent-specific section (overrides)
  const sections = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) {
      if (current) { sections.push(current); current = null; }
      continue;
    }
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();

    if (key === 'user-agent') {
      if (current && current.ua.length > 0 && !current.ua.includes(val.toLowerCase())) {
        sections.push(current);
        current = { ua: [val.toLowerCase()], disallow: [], allow: [] };
      } else if (!current) {
        current = { ua: [val.toLowerCase()], disallow: [], allow: [] };
      } else {
        current.ua.push(val.toLowerCase());
      }
    } else if (current) {
      if (key === 'disallow' && val) current.disallow.push(val);
      else if (key === 'allow' && val) current.allow.push(val);
    }
  }
  if (current) sections.push(current);

  const agentLower = userAgent.toLowerCase().split('/')[0];

  // Find most specific section
  let matched = sections.find(s => s.ua.includes(agentLower));
  if (!matched) matched = sections.find(s => s.ua.includes('*'));
  if (!matched) return false;

  for (const checkPath of paths) {
    const disallowed = matched.disallow.some(d => checkPath.startsWith(d));
    const allowed = matched.allow.some(a => checkPath.startsWith(a));
    if (disallowed && !allowed) return true;
  }
  return false;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(url) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS * attempt);
      log('debug', `  retry ${attempt}/${MAX_RETRIES - 1} for ${url}`);
    }
    try {
      const res = await fetchWithTimeout(url, TIMEOUT_MS);
      const html = await res.text();
      return { status: res.status, html };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// ─── Snapshot store (gzip, resume-aware) ─────────────────────────────────────

function snapshotFilename(url) {
  // URL hash → deterministic filename
  const hash = crypto.createHash('sha256').update(url).digest('hex');
  return `${hash.slice(0, 16)}.html.gz`;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function saveSnapshot(url, html) {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const filename = snapshotFilename(url);
  const fullPath = path.join(SNAPSHOT_DIR, filename);
  if (await fileExists(fullPath)) {
    return { path: fullPath, wasDuplicate: true };
  }
  const compressed = await gzip(Buffer.from(html, 'utf-8'), { level: 9 });
  const tempPath = `${fullPath}.tmp.${Date.now()}`;
  try {
    await writeFile(tempPath, compressed);
    // Atomic rename
    const { rename } = await import('node:fs/promises');
    await rename(tempPath, fullPath);
  } catch (err) {
    try { const { unlink } = await import('node:fs/promises'); await unlink(tempPath); } catch { /* ignore cleanup error */ }
    throw err;
  }
  return { path: fullPath, wasDuplicate: false };
}

async function loadSnapshot(url) {
  const filename = snapshotFilename(url);
  const fullPath = path.join(SNAPSHOT_DIR, filename);
  if (!(await fileExists(fullPath))) return null;
  const compressed = await readFile(fullPath);
  const html = (await gunzip(compressed)).toString('utf-8');
  return { html, path: fullPath };
}

// ─── Logger ───────────────────────────────────────────────────────────────────

function log(level, message) {
  const ts = new Date().toISOString();
  const prefix = { info: '[INFO]', warn: '[WARN]', error: '[ERR ]', debug: '[DBG ]' }[level] ?? '[INFO]';
  process.stdout.write(`${ts} ${prefix} ${message}\n`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Category page discovery ──────────────────────────────────────────────────

function buildCategoryPageUrls(baseUrl, sigmaId, expectedPages) {
  const urls = [];
  for (let page = 1; page <= expectedPages; page++) {
    const url = new URL(`/en/category/${sigmaId}`, baseUrl);
    if (page > 1) url.searchParams.set('page', String(page));
    urls.push(url.href);
  }
  return urls;
}

async function discoverCategory(seed) {
  const firstUrl = buildSigmaCategoryUrl(BASE_URL, seed.sigmaId);
  log('info', `[${seed.id}] Fetching page 1: ${firstUrl}`);

  let firstFetch;
  try {
    firstFetch = await fetchHtml(firstUrl);
  } catch (err) {
    return {
      seedId: seed.id,
      categoryUrl: firstUrl,
      totalItems: 0,
      expectedPages: 0,
      generatedPages: [],
      processedPages: [],
      missingPages: [],
      productUrls: [],
      error: `FETCH_FAILED: ${err.message}`,
    };
  }

  if (firstFetch.status !== 200) {
    return {
      seedId: seed.id,
      categoryUrl: firstUrl,
      totalItems: 0,
      expectedPages: 0,
      generatedPages: [],
      processedPages: [],
      missingPages: [],
      productUrls: [],
      error: `HTTP_${firstFetch.status}`,
    };
  }

  // Save snapshot for page 1
  try { await saveSnapshot(firstUrl, firstFetch.html); } catch {}

  // Parse page 1 to get pagination info
  let firstParsed;
  try {
    firstParsed = parseCategoryPage(firstFetch.html);
  } catch (err) {
    return {
      seedId: seed.id,
      categoryUrl: firstUrl,
      totalItems: 0,
      expectedPages: 0,
      generatedPages: [firstUrl],
      processedPages: [firstUrl],
      missingPages: [],
      productUrls: [],
      error: `PARSE_FAILED: ${err.message}`,
    };
  }

  const totalItems = firstParsed.pagination.totalItems ?? 0;
  const expectedPages = totalItems > 0 ? Math.ceil(totalItems / PER_PAGE) : 1;
  const generatedPages = buildCategoryPageUrls(BASE_URL, seed.sigmaId, expectedPages);

  log(
    'info',
    `[${seed.id}] totalItems=${totalItems} expectedPages=${expectedPages} found=${firstParsed.products.length} products on page 1`,
  );

  const processedPages = new Set([generatedPages[0] ?? firstUrl]);
  const productUrls = [];

  // Collect products from page 1
  for (const p of firstParsed.products) {
    if (p.slug) {
      productUrls.push(buildSigmaProductUrl(BASE_URL, p.slug));
    }
  }

  // Fetch remaining pages (2..N)
  for (let i = 1; i < generatedPages.length; i++) {
    const pageUrl = generatedPages[i];
    log('info', `[${seed.id}] Fetching page ${i + 1}/${expectedPages}: ${pageUrl}`);

    try {
      const pageFetch = await fetchHtml(pageUrl);

      if (pageFetch.status !== 200) {
        log('warn', `[${seed.id}] Page ${i + 1} returned HTTP ${pageFetch.status} — skipping`);
        continue;
      }

      try { await saveSnapshot(pageUrl, pageFetch.html); } catch {}

      let pageParsed;
      try {
        pageParsed = parseCategoryPage(pageFetch.html);
      } catch (err) {
        log('warn', `[${seed.id}] Page ${i + 1} parse failed: ${err.message}`);
        continue;
      }

      processedPages.add(pageUrl);
      for (const p of pageParsed.products) {
        if (p.slug) {
          productUrls.push(buildSigmaProductUrl(BASE_URL, p.slug));
        }
      }

      log('info', `[${seed.id}] Page ${i + 1} done — ${pageParsed.products.length} products`);
    } catch (err) {
      log('warn', `[${seed.id}] Page ${i + 1} fetch failed: ${err.message}`);
    }
  }

  const processedArr = [...processedPages];
  const missingPages = generatedPages.filter(u => !processedPages.has(u));

  log(
    'info',
    `[${seed.id}] Discovery done — processed=${processedArr.length}/${expectedPages} pages, collected=${productUrls.length} product URLs, missing=${missingPages.length}`,
  );

  return {
    seedId: seed.id,
    categoryUrl: firstUrl,
    totalItems,
    expectedPages,
    generatedPages,
    processedPages: processedArr,
    missingPages,
    productUrls,
    error: null,
  };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicateUrls(urls) {
  const seen = new Set();
  const unique = [];
  let duplicates = 0;
  for (const url of urls) {
    // Canonicalize before dedup
    let canonical;
    try {
      canonical = canonicalizeSigmaUrl(new URL(url));
    } catch {
      canonical = url;
    }
    if (seen.has(canonical)) {
      duplicates++;
    } else {
      seen.add(canonical);
      unique.push(canonical);
    }
  }
  return { unique, duplicates };
}

// ─── Product fetching & parsing ───────────────────────────────────────────────

async function fetchAndParseProduct(url, index, total, categoryHint) {
  const label = `[${index + 1}/${total}]`;

  // Try resume from snapshot first
  let html;
  let fromCache = false;
  const existing = await loadSnapshot(url);

  if (existing) {
    html = existing.html;
    fromCache = true;
    log('debug', `${label} Resume from snapshot: ${url}`);
  } else {
    log('info', `${label} Fetching: ${url}`);
    let fetchResult;
    try {
      fetchResult = await fetchHtml(url);
    } catch (err) {
      return {
        success: false,
        url,
        error: `FETCH_FAILED: ${err.message}`,
        record: null,
      };
    }

    if (fetchResult.status !== 200) {
      return {
        success: false,
        url,
        error: `HTTP_${fetchResult.status}`,
        record: null,
      };
    }

    html = fetchResult.html;

    // Save snapshot
    try {
      await saveSnapshot(url, html);
    } catch (err) {
      log('warn', `${label} Snapshot save failed: ${err.message}`);
    }
  }

  // Parse
  let parsedPage;
  try {
    parsedPage = parseProductPage(html);
  } catch (err) {
    return {
      success: false,
      url,
      error: `PARSE_FAILED: ${err.message}`,
      record: null,
    };
  }

  if (!parsedPage) {
    return {
      success: false,
      url,
      error: 'PARSE_FAILED: parseProductPage returned null (no RSC product found)',
      record: null,
    };
  }

  // Map to raw fields
  let mapped;
  try {
    mapped = mapSigmaProductToRaw(parsedPage.product, parsedPage.breadcrumb);
  } catch (err) {
    return {
      success: false,
      url,
      error: `MAPPER_FAILED: ${err.message}`,
      record: null,
    };
  }

  const product = parsedPage.product;
  const raw = mapped.raw;

  // Build output record with all required fields, null for missing values
  const record = {
    sigmaUuid: mapped.externalId ?? null,
    sourceUrl: url,
    title: raw.title ?? null,
    category: categoryHint ?? product.category?.name ?? null,
    priceText: raw.priceText ?? null,
    priceValue: product.price?.current ?? null,
    currency: product.price?.currency ?? null,
    availability: raw.availabilityText ?? null,
    imageUrls: Array.isArray(raw.imageUrls) ? raw.imageUrls : [],
    breadcrumbs: Array.isArray(raw.breadcrumbs) ? raw.breadcrumbs : [],
    specifications: Array.isArray(raw.specifications) ? raw.specifications : [],
    skuText: raw.skuText ?? null,
    brandText: raw.brandText ?? null,
    descriptionText: raw.descriptionText ?? null,
    parseWarnings: Array.isArray(mapped.warnings) ? mapped.warnings : [],
    captureTimestamp: new Date().toISOString(),
    fromCache,
  };

  const warnSuffix = mapped.warnings.length > 0 ? ` warnings=${mapped.warnings.length}` : '';
  log('info', `${label} OK title="${record.title}" price=${record.priceText}${warnSuffix}`);

  return { success: true, url, error: null, record };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('info', '═══════════════════════════════════════════════════');
  log('info', '  BuildSense — Sigma One-Time Bootstrap Import');
  log('info', `  Base URL  : ${BASE_URL}`);
  log('info', `  Seed filter: ${SEED_ID ?? '(all enabled categories)'}`);
  log('info', '═══════════════════════════════════════════════════');

  // 1. robots.txt
  const robotsDecision = await checkRobots(BASE_URL);
  if (robotsDecision === 'DENIED') {
    log('error', 'robots.txt denied — aborting import');
    process.exitCode = 1;
    return;
  }

  // 2. Resolve enabled seeds
  const enabledSeeds = SIGMA_CATEGORY_SEEDS.filter(
    (s) => s.enabled !== false && (SEED_ID === undefined || s.id === SEED_ID),
  );

  if (enabledSeeds.length === 0) {
    log('error', `No enabled seeds found${SEED_ID ? ` matching --seed-id ${SEED_ID}` : ''}`);
    process.exitCode = 1;
    return;
  }

  log('info', `Seeds to process: ${enabledSeeds.map((s) => s.id).join(', ')}`);

  // 3. Create output dirs
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(SNAPSHOT_DIR, { recursive: true });

  // 4. Discover all category pages
  log('info', '─── Discovery phase ────────────────────────────────');
  const captureTimestamp = new Date().toISOString();
  const categoryResults = [];

  for (const seed of enabledSeeds) {
    const result = await discoverCategory(seed);
    categoryResults.push(result);
  }

  // 5. Collect and deduplicate product URLs
  const allProductUrls = categoryResults.flatMap((c) => c.productUrls);
  const { unique: uniqueProductUrls, duplicates } = deduplicateUrls(allProductUrls);

  log('info', `─── Product fetch phase ─────────────────────────────`);
  log(
    'info',
    `Total: extracted=${allProductUrls.length} unique=${uniqueProductUrls.length} duplicates=${duplicates}`,
  );

  // Build a category hint map (url → category id)
  const urlToCategoryHint = new Map();
  for (const cat of categoryResults) {
    for (const url of cat.productUrls) {
      let canonical;
      try { canonical = canonicalizeSigmaUrl(new URL(url)); } catch { canonical = url; }
      if (!urlToCategoryHint.has(canonical)) {
        urlToCategoryHint.set(canonical, cat.seedId);
      }
    }
  }

  // 6. Fetch & parse each unique product
  const products = [];
  const errors = [];

  for (let i = 0; i < uniqueProductUrls.length; i++) {
    const url = uniqueProductUrls[i];
    const categoryHint = urlToCategoryHint.get(url) ?? null;

    const result = await fetchAndParseProduct(url, i, uniqueProductUrls.length, categoryHint);

    if (result.success && result.record) {
      products.push(result.record);
    } else {
      errors.push({
        url: result.url,
        error: result.error,
        captureTimestamp: new Date().toISOString(),
      });
      log('warn', `  FAILED: ${result.url} — ${result.error}`);
    }
  }

  // 7. Build manifest
  log('info', '─── Writing output files ───────────────────────────');

  const categoriesManifest = categoryResults.map((c) => ({
    seedId: c.seedId,
    categoryUrl: c.categoryUrl,
    totalItems: c.totalItems,
    expectedPages: c.expectedPages,
    generatedPages: c.generatedPages.length,
    processedPages: c.processedPages.length,
    missingPages: c.missingPages,
    productUrlsCollected: c.productUrls.length,
    error: c.error,
  }));

  const totalExpected = categoriesManifest.reduce((acc, c) => acc + c.expectedPages, 0);
  const totalProcessed = categoriesManifest.reduce((acc, c) => acc + c.processedPages, 0);
  const totalMissing = categoriesManifest.reduce((acc, c) => acc + c.missingPages.length, 0);
  const hasCategoryErrors = categoryResults.some((c) => c.error !== null);

  const isComplete =
    totalMissing === 0 &&
    totalProcessed >= totalExpected &&
    errors.length === 0 &&
    !hasCategoryErrors;

  const manifest = {
    captureTimestamp,
    bootstrapStatus: isComplete ? 'COMPLETE' : 'INCOMPLETE',
    categoriesProcessed: categoriesManifest.map((c) => c.seedId),
    categories: categoriesManifest,
    categoryPages: {
      expected: totalExpected,
      processed: totalProcessed,
      missing: totalMissing,
    },
    productUrls: {
      extracted: allProductUrls.length,
      unique: uniqueProductUrls.length,
      duplicates,
    },
    fetch: {
      successful: products.length,
      failed: errors.length,
    },
    datasetFiles: {
      products: path.join('data', 'bootstrap', 'sigma-products.json'),
      manifest: path.join('data', 'bootstrap', 'sigma-import-manifest.json'),
      errors: path.join('data', 'bootstrap', 'sigma-import-errors.json'),
      snapshots: path.join('data', 'bootstrap', 'snapshots'),
    },
    incompleteReasons: [
      ...(totalMissing > 0 ? [`${totalMissing} category page(s) missing`] : []),
      ...(errors.length > 0 ? [`${errors.length} product fetch/parse failure(s)`] : []),
      ...(hasCategoryErrors ? ['one or more category discovery errors'] : []),
    ],
  };

  const productsPath = path.join(OUTPUT_DIR, 'sigma-products.json');
  const manifestPath = path.join(OUTPUT_DIR, 'sigma-import-manifest.json');
  const errorsPath = path.join(OUTPUT_DIR, 'sigma-import-errors.json');

  await writeFile(productsPath, JSON.stringify(products, null, 2), 'utf-8');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  await writeFile(errorsPath, JSON.stringify(errors, null, 2), 'utf-8');

  // 8. Final summary
  log('info', '═══════════════════════════════════════════════════');
  log('info', `  Bootstrap status : ${manifest.bootstrapStatus}`);
  log('info', `  Categories       : ${manifest.categoriesProcessed.length}`);
  log('info', `  Pages expected   : ${totalExpected}`);
  log('info', `  Pages processed  : ${totalProcessed}`);
  log('info', `  Pages missing    : ${totalMissing}`);
  log('info', `  Product URLs     : unique=${uniqueProductUrls.length} dupes=${duplicates}`);
  log('info', `  Successful parses: ${products.length}`);
  log('info', `  Failed           : ${errors.length}`);
  log('info', `  Output dir       : ${OUTPUT_DIR}`);
  log('info', '═══════════════════════════════════════════════════');

  if (manifest.bootstrapStatus === 'INCOMPLETE') {
    log('warn', 'Dataset is INCOMPLETE. Reasons:');
    for (const reason of manifest.incompleteReasons) {
      log('warn', `  • ${reason}`);
    }
    process.exitCode = 1;
  } else {
    log('info', 'Dataset is COMPLETE and ready for M3 normalization.');
  }
}

main().catch((err) => {
  log('error', `Unhandled fatal error: ${err.message}`);
  if (err.stack) log('error', err.stack);
  process.exitCode = 1;
});
