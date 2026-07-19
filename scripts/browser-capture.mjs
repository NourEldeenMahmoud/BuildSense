#!/usr/bin/env node
/**
 * browser-capture.mjs
 *
 * One-time resumable visible-browser capture for BuildSense.
 * Launches a headed Chromium browser, navigates store category pages,
 * follows pagination, captures product HTML, and exports progress/manifest.
 *
 * Usage:
 *   node scripts/browser-capture.mjs --store el-nour-tech --output <dir> [--resume] [--cdp-url <url>]
 *   node scripts/browser-capture.mjs --store alfrensia --output <dir> [--resume] [--cdp-url <url>]
 *
 * Options:
 *   --store <name>       Store to capture (el-nour-tech | alfrensia)
 *   --output <dir>       Output directory for HTML + manifest + progress
 *   --resume             Resume from existing progress.json
 *   --cdp-url <url>      Connect to existing browser via CDP instead of launching
 *   --max-products <n>   (debug/test) Limit total products to capture
 *   --help               Show this help
 *
 * Security:
 *   - No cookies/storage state saved
 *   - Only HTML + audit metadata output
 *   - No credentials handling
 */

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { readFile, writeFile, mkdir, appendFile, rename } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════════════
// Store configurations
// ═══════════════════════════════════════════════════════════════════════════════

const STORE_CONFIGS = {
  'el-nour-tech': {
    host: 'elnour-tech.com',
    baseUrl: 'https://elnour-tech.com',
    locale: '/en/',
    categoryBase: '/en/product-category/pc-parts/',
    categories: [
      { id: 'cpu', slug: 'processors' },
      { id: 'gpu', slug: 'graphics-cards' },
      { id: 'motherboard', slug: 'motherboards' },
      { id: 'ram', slug: 'ram' },
      { id: 'ssd', slug: 'ssd' },
      { id: 'hdd', slug: 'hdd' },
      { id: 'psu', slug: 'power-supply' },
      { id: 'case', slug: 'pc-cases' },
      { id: 'cooling', slug: 'cooling' },
    ],
    // El Nour uses ?page=N query pagination
    paginationStyle: 'query',
    productSelector: 'div.wd-product.product-grid-item',
    productLinkSelector: 'a.wd-product-img-link',
    nextLinkSelector: 'nav.woocommerce-pagination a.next.page-numbers',
    paginationSelector: 'nav.woocommerce-pagination',
    // Product URL pattern: /en/product/<slug>/
    productUrlPattern: /\/en\/product\/[^/]+\/?$/,
    categoryUrlPattern: /\/en\/product-category\/pc-parts\/[^/]+\/?$/,
  },
  'alfrensia': {
    host: 'alfrensia.com',
    baseUrl: 'https://alfrensia.com',
    locale: '/en/',
    categoryBase: '/en/product-category/',
    categories: [
      { id: 'processor', slug: 'processor' },
      { id: 'graphics-card', slug: 'graphics-card' },
      { id: 'motherboard', slug: 'motherboard' },
      { id: 'ram', slug: 'ram' },
      { id: 'power-supply', slug: 'power-supply' },
      { id: 'cases', slug: 'cases' },
      { id: 'air-liquid-cooling', slug: 'air-liquid-cooling' },
      { id: 'case-fans', slug: 'case-fans' },
      { id: 'monitors', slug: 'monitors' },
    ],
    // Alfrensia uses /page/N/ path pagination
    paginationStyle: 'path',
    productSelector: 'div.product-small[data-product_id]',
    productLinkSelector: 'p.name.product-title a',
    nextLinkSelector: 'nav.woocommerce-pagination a.next.page-numbers, .woocommerce-pagination a.next.page-numbers',
    paginationSelector: 'nav.woocommerce-pagination, .woocommerce-pagination',
    // Product URL pattern: /en/product/<slug>/
    productUrlPattern: /\/en\/product\/[^/]+\/?$/,
    categoryUrlPattern: /\/en\/product-category\/[^/]+\/?$/,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Challenge/CAPTCHA detection signatures
// ═══════════════════════════════════════════════════════════════════════════════

const CHALLENGE_SIGNATURES = [
  /cloudflare/i,
  /challenge-platform/i,
  /cf-browser-verification/i,
  /just a moment/i,
  /checking your browser/i,
  /enable javascript/i,
  /ray id/i,
  /captcha/i,
  /recaptcha/i,
  /hcaptcha/i,
  /access denied/i,
  /forbidden/i,
  /rate limit/i,
  /too many requests/i,
  /please verify/i,
  /verify you are human/i,
  /security check/i,
  /bot detection/i,
  /login required/i,
  /sign in/i,
  /wp-login/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    store: null,
    output: null,
    resume: false,
    cdpUrl: null,
    maxProducts: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--store':
        result.store = args[++i];
        break;
      case '--output':
        result.output = args[++i];
        break;
      case '--resume':
        result.resume = true;
        break;
      case '--cdp-url':
        result.cdpUrl = args[++i];
        break;
      case '--max-products':
        result.maxProducts = Number.parseInt(args[++i], 10);
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  if (result.help) {
    printHelp();
    process.exit(0);
  }

  if (!result.store) {
    console.error('Error: --store is required (el-nour-tech | alfrensia)');
    process.exit(1);
  }
  if (!STORE_CONFIGS[result.store]) {
    console.error(`Error: Unknown store "${result.store}". Must be el-nour-tech or alfrensia.`);
    process.exit(1);
  }
  if (!result.output) {
    console.error('Error: --output is required');
    process.exit(1);
  }
  if (result.maxProducts !== null && (!Number.isFinite(result.maxProducts) || result.maxProducts < 1)) {
    console.error('Error: --max-products must be a positive integer');
    process.exit(1);
  }

  return result;
}

function printHelp() {
  console.log(`
browser-capture.mjs — One-time resumable visible-browser capture

Usage:
  node scripts/browser-capture.mjs --store <name> --output <dir> [options]

Options:
  --store <name>       Store to capture: el-nour-tech | alfrensia
  --output <dir>       Output directory for HTML + manifest + progress
  --resume             Resume from existing progress.json
  --cdp-url <url>      Connect to existing visible Chrome via CDP
  --max-products <n>   (debug/test) Limit total products to capture
  --help               Show this help

Examples:
  # Capture El Nour Tech with visible browser
  node scripts/browser-capture.mjs --store el-nour-tech --output data/captures/el-nour-tech

  # Capture Alfrensia, resume from progress
  node scripts/browser-capture.mjs --store alfrensia --output data/captures/alfrensia --resume

  # Connect to existing Chrome
  node scripts/browser-capture.mjs --store el-nour-tech --output data/captures/el-nour-tech --cdp-url http://localhost:9222

  # Debug: capture only 5 products
  node scripts/browser-capture.mjs --store el-nour-tech --output data/captures/el-nour-tech --max-products 5

Output files:
  products.ndjson       Captured product HTML files + audit metadata
  manifest.json         Manifest for offline importer
  progress.json         Resume state (categories, queues, completed, failed)
  products/             Raw HTML files per product
`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// URL utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonicalize a URL by stripping tracking params and normalizing trailing slash.
 */
export function canonicalizeUrl(urlStr) {
  const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'ref', 'source', 'add-to-cart', 'quantity', 'variation_id',
  ]);
  try {
    const url = new URL(urlStr);
    const canonical = new URL(url.origin + url.pathname);
    for (const [key, value] of url.searchParams.entries()) {
      if (!TRACKING_PARAMS.has(key)) {
        canonical.searchParams.set(key, value);
      }
    }
    // Normalize trailing slash for consistency (only pathname, preserve query)
    let pathname = canonical.pathname.replace(/\/+$/, '') + '/';
    // Rebuild full URL with origin + query string if present
    const qs = canonical.search;
    return canonical.origin + pathname + qs;
  } catch {
    return urlStr;
  }
}

/**
 * Build a category URL for a given store config.
 */
export function buildCategoryUrl(config, slug, pageNum = 1) {
  if (config.paginationStyle === 'query') {
    // El Nour: /en/product-category/pc-parts/<slug>/?page=N
    let url = `${config.baseUrl}${config.categoryBase}${slug}/`;
    if (pageNum > 1) {
      url += `?page=${pageNum}`;
    }
    return url;
  } else {
    // Alfrensia: /en/product-category/<slug>/page/N/
    let url = `${config.baseUrl}${config.categoryBase}${slug}/`;
    if (pageNum > 1) {
      url += `page/${pageNum}/`;
    }
    return url;
  }
}

/**
 * Extract the next page URL from a page's HTML given the store config.
 * Returns null if no next page link exists.
 */
export function extractNextPageUrl(html, currentUrl, config) {
  // Look for a visible "Next" pagination link
  const nextPatterns = [
    // Common WooCommerce next link patterns
    /<a[^>]*class="[^"]*next[^"]*page-numbers[^"]*"[^>]*href="([^"]+)"/i,
    /<a[^>]*href="([^"]+)"[^>]*class="[^"]*next[^"]*page-numbers[^"]*"/i,
    // Generic next page link
    /<link[^>]*rel="next"[^>]*href="([^"]+)"/i,
  ];

  for (const pattern of nextPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      let href = match[1];
      // Make absolute if relative
      if (href.startsWith('/')) {
        href = new URL(href, currentUrl).href;
      } else if (!href.startsWith('http')) {
        href = new URL(href, currentUrl).href;
      }
      return href;
    }
  }

  return null;
}

/**
 * Extract product URLs from a category page HTML.
 * Returns array of { url, externalId } objects.
 */
export function extractProductLinks(html, config) {
  const products = [];
  const seen = new Set();

  // Strategy 1: Find all links matching product URL pattern
  const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>/gi;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;

    let fullUrl;
    try {
      fullUrl = new URL(href, config.baseUrl).href;
    } catch {
      continue;
    }

    if (!config.productUrlPattern.test(new URL(fullUrl).pathname)) continue;
    if (!fullUrl.includes(config.host)) continue;

    const canonical = canonicalizeUrl(fullUrl);
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    products.push({ url: canonical, externalId: null });
  }

  return products;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Challenge detection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect if page content indicates a challenge/CAPTCHA/block.
 * Returns { blocked: boolean, reason: string | null }
 */
export function detectChallenge(html) {
  const text = html.substring(0, 50_000); // Only check first 50KB
  for (const pattern of CHALLENGE_SIGNATURES) {
    if (pattern.test(text)) {
      return { blocked: true, reason: `Challenge detected: ${pattern.source}` };
    }
  }
  return { blocked: false, reason: null };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Progress management
// ═══════════════════════════════════════════════════════════════════════════════

function createInitialProgress(storeConfig) {
  return {
    store: storeConfig,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: null,
    discoveryState: null, // null = never initialized, 'seeded' = categories queued, 'completed' = all done
    categories: {},   // categoryId -> { discovered: number, completed: number }
    queue: [],         // [{ url, category, pageNum }]
    completed: {},     // canonicalUrl -> { htmlFile, capturedAt, title, category, ... }
    failed: {},        // canonicalUrl -> { attempts, reason, lastAttemptAt }
    skipped: {},       // canonicalUrl -> { reason }
    identityIndex: {}, // skuOrMp -> canonicalUrl (for dedup by identity)
    stats: {
      totalPagesVisited: 0,
      totalProductsFound: 0,
      totalProductsCaptured: 0,
      totalFailed: 0,
      totalSkipped: 0,
    },
  };
}

/**
 * Determine whether category discovery should be seeded based on progress state.
 * Pure function — safe to test without browser or filesystem.
 *
 * Rules:
 * - discoveryState is null/undefined → seed (first run or legacy progress without field)
 * - discoveryState is 'seeded' AND queue is empty → reseed (interrupted mid-crawl, queue exhausted before completion)
 * - discoveryState is 'seeded' AND queue not empty → skip (resume in progress)
 * - discoveryState is 'completed' → skip (genuinely finished crawl, never reseed)
 */
export function shouldSeedCategories(progress) {
  if (!progress.discoveryState) return true;
  if (progress.discoveryState === 'seeded' && progress.queue.length === 0) return true;
  return false;
}

async function loadProgress(outputDir, storeConfig) {
  const progressPath = path.join(outputDir, 'progress.json');
  try {
    const data = await readFile(progressPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return createInitialProgress(storeConfig);
  }
}

async function saveProgress(outputDir, progress) {
  const progressPath = path.join(outputDir, 'progress.json');
  const tmpPath = progressPath + '.tmp';
  progress.lastUpdatedAt = new Date().toISOString();
  await writeFile(tmpPath, JSON.stringify(progress, null, 2), 'utf-8');
  await rename(tmpPath, progressPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Manifest management
// ═══════════════════════════════════════════════════════════════════════════════

async function saveManifest(outputDir, progress) {
  const manifestPath = path.join(outputDir, 'manifest.json');
  const entries = Object.entries(progress.completed).map(([url, info]) => ({
    url,
    htmlFile: info.htmlFile,
    capturedAt: info.capturedAt,
  }));
  const manifest = { entries };
  const tmpPath = manifestPath + '.tmp';
  await writeFile(tmpPath, JSON.stringify(manifest, null, 2), 'utf-8');
  await rename(tmpPath, manifestPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
// products.ndjson management
// ═══════════════════════════════════════════════════════════════════════════════

async function appendProductNdjson(outputDir, productMeta) {
  const ndjsonPath = path.join(outputDir, 'products.ndjson');
  const line = JSON.stringify(productMeta) + '\n';
  await appendFile(ndjsonPath, line, 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Atomic save after each product attempt
// ═══════════════════════════════════════════════════════════════════════════════

async function atomicSaveAfterAttempt(outputDir, progress, productMeta) {
  await Promise.all([
    saveProgress(outputDir, progress),
    saveManifest(outputDir, progress),
    productMeta ? appendProductNdjson(outputDir, productMeta) : Promise.resolve(),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Logging
// ═══════════════════════════════════════════════════════════════════════════════

function log(level, msg, data) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  if (data) {
    console.log(`${prefix} ${msg}`, data);
  } else {
    console.log(`${prefix} ${msg}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTML sanitization for filenames
// ═══════════════════════════════════════════════════════════════════════════════

function sanitizeFilename(url) {
  try {
    const parsed = new URL(url);
    const slug = parsed.pathname
      .replace(/\/+$/, '')
      .split('/')
      .filter(Boolean)
      .pop() || 'product';
    // Truncate and sanitize
    return slug
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 120);
  } catch {
    return `product-${Date.now()}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Bootstrap from existing manifest (for resume)
// ═══════════════════════════════════════════════════════════════════════════════

async function bootstrapFromExistingManifest(outputDir, progress) {
  const manifestPath = path.join(outputDir, 'manifest.json');
  try {
    const data = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(data);
    if (manifest.entries && Array.isArray(manifest.entries)) {
      for (const entry of manifest.entries) {
        if (!progress.completed[entry.url]) {
          progress.completed[entry.url] = {
            htmlFile: entry.htmlFile,
            capturedAt: entry.capturedAt,
            title: null,
            category: 'unknown',
            price: null,
            sku: null,
            mpn: null,
            source: 'existing-manifest',
          };
        }
      }
      log('info', `Bootstrapped ${manifest.entries.length} entries from existing manifest`);
    }
  } catch {
    // No existing manifest, that's fine
  }
  return progress;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main capture logic
// ═══════════════════════════════════════════════════════════════════════════════

async function capture(args) {
  const storeConfig = STORE_CONFIGS[args.store];
  const outputDir = path.resolve(args.output);

  // Ensure output directory
  await mkdir(path.join(outputDir, 'products'), { recursive: true });

  // Load or create progress
  let progress;
  if (args.resume) {
    progress = await loadProgress(outputDir, storeConfig);
    log('info', `Resumed progress: ${progress.stats.totalProductsCaptured} products captured so far`);
    // Bootstrap from existing manifest if needed
    progress = await bootstrapFromExistingManifest(outputDir, progress);
  } else {
    progress = createInitialProgress(storeConfig);
  }

  // Launch or connect to browser
  let browser;
  let context;
  let isOwnBrowser = false;

  if (args.cdpUrl) {
    log('info', `Connecting to existing browser at ${args.cdpUrl}`);
    browser = await chromium.connectOverCDP(args.cdpUrl);
    isOwnBrowser = false;
    // Use existing context or create a new one
    const contexts = browser.contexts();
    context = contexts[0] || await browser.newContext();
  } else {
    const profileDir = path.join(os.tmpdir(), `buildsense-capture-${args.store}`);
    log('info', `Launching headed Chromium with profile: ${profileDir}`);
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    isOwnBrowser = true;
  }

  const page = await context.newPage();

  try {
    // Build initial queue of category pages to visit if discovery not yet completed
    if (shouldSeedCategories(progress)) {
      log('info', 'Building initial category queue...');
      for (const cat of storeConfig.categories) {
        const firstUrl = buildCategoryUrl(storeConfig, cat.slug, 1);
        progress.queue.push({ url: firstUrl, category: cat.id, pageNum: 1 });
        progress.categories[cat.id] = { discovered: 0, completed: 0 };
      }
      progress.discoveryState = 'seeded';
      await saveProgress(outputDir, progress);
    } else if (progress.discoveryState === 'seeded' && progress.queue.length > 0) {
      log('info', `Resuming with ${progress.queue.length} queued categories`);
    } else if (progress.discoveryState === 'completed') {
      log('info', 'Discovery already completed — nothing to seed');
    }

    // Process queue
    while (progress.queue.length > 0) {
      // Check max products limit
      if (args.maxProducts !== null && progress.stats.totalProductsCaptured >= args.maxProducts) {
        log('info', `Reached --max-products limit (${args.maxProducts}). Stopping.`);
        break;
      }

      const item = progress.queue.shift();
      const canonicalUrl = canonicalizeUrl(item.url);

      log('info', `[Queue] Processing: ${item.category} page ${item.pageNum} — ${canonicalUrl}`);

      // Skip if already completed
      if (progress.completed[canonicalUrl]) {
        log('info', `[Skip] Already completed: ${canonicalUrl}`);
        continue;
      }

      // Skip if failed too many times
      const failedInfo = progress.failed[canonicalUrl];
      if (failedInfo && failedInfo.attempts >= 3) {
        log('warn', `[Skip] Failed ${failedInfo.attempts} times: ${canonicalUrl} — ${failedInfo.reason}`);
        continue;
      }

      // Navigate to category page
      let html;
      let challengeResult;
      try {
        await page.goto(canonicalUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        // Wait a bit for dynamic content
        await page.waitForTimeout(2000);
        html = await page.content();
        challengeResult = detectChallenge(html);

        if (challengeResult.blocked) {
          log('warn', `[Challenge] ${canonicalUrl}: ${challengeResult.reason}`);
          progress.failed[canonicalUrl] = {
            attempts: (progress.failed[canonicalUrl]?.attempts || 0) + 1,
            reason: challengeResult.reason,
            lastAttemptAt: new Date().toISOString(),
          };
          progress.stats.totalFailed++;
          await atomicSaveAfterAttempt(outputDir, progress, null);
          continue;
        }

        progress.stats.totalPagesVisited++;
      } catch (err) {
        log('error', `[Nav] Failed to load ${canonicalUrl}: ${err.message}`);
        progress.failed[canonicalUrl] = {
          attempts: (progress.failed[canonicalUrl]?.attempts || 0) + 1,
          reason: `Navigation error: ${err.message}`,
          lastAttemptAt: new Date().toISOString(),
        };
        progress.stats.totalFailed++;
        await atomicSaveAfterAttempt(outputDir, progress, null);
        continue;
      }

      // Extract product links from category page
      const productLinks = extractProductLinks(html, storeConfig);
      log('info', `[Category] Found ${productLinks.length} product links on page ${item.pageNum}`);

      if (progress.categories[item.category]) {
        progress.categories[item.category].discovered += productLinks.length;
      }
      progress.stats.totalProductsFound += productLinks.length;

      // Add product URLs to completed if not already present (category page visited = products discovered)
      // But we don't capture them here — we'll capture them in product processing below
      // For now, track the category page itself as completed
      progress.completed[canonicalUrl] = {
        htmlFile: `_category_page_${item.category}_p${item.pageNum}.html`,
        capturedAt: new Date().toISOString(),
        title: `[Category: ${item.category} page ${item.pageNum}]`,
        category: item.category,
        price: null,
        sku: null,
        mpn: null,
        source: 'category-page',
      };

      // Extract and follow pagination
      const nextUrl = extractNextPageUrl(html, canonicalUrl, storeConfig);
      if (nextUrl) {
        const nextCanonical = canonicalizeUrl(nextUrl);
        if (!progress.completed[nextCanonical] && !progress.queue.some(q => canonicalizeUrl(q.url) === nextCanonical)) {
          log('info', `[Pagination] Next page found: ${nextCanonical}`);
          progress.queue.push({ url: nextCanonical, category: item.category, pageNum: item.pageNum + 1 });
        }
      }

      // Save category page HTML for reference
      const catHtmlFile = `_category_page_${item.category}_p${item.pageNum}.html`;
      try {
        await writeFile(path.join(outputDir, 'products', catHtmlFile), html, 'utf-8');
      } catch (err) {
        log('warn', `[Save] Failed to save category HTML: ${err.message}`);
      }

      await atomicSaveAfterAttempt(outputDir, progress, null);

      // Process each product link found on this category page
      for (const productLink of productLinks) {
        // Check max products limit
        if (args.maxProducts !== null && progress.stats.totalProductsCaptured >= args.maxProducts) {
          log('info', `Reached --max-products limit (${args.maxProducts}). Stopping product processing.`);
          break;
        }

        const productCanonical = canonicalizeUrl(productLink.url);

        // Skip if already completed
        if (progress.completed[productCanonical]) {
          log('info', `[Skip] Already captured: ${productCanonical}`);
          continue;
        }

        // Skip if failed too many times
        if (progress.failed[productCanonical] && progress.failed[productCanonical].attempts >= 3) {
          log('info', `[Skip] Max retries reached: ${productCanonical}`);
          continue;
        }

        // Attempt to capture this product (with retries)
        let captured = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          log('info', `[Product] Attempt ${attempt}/3: ${productCanonical}`);

          try {
            await page.goto(productCanonical, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            await page.waitForTimeout(1500);
            const productHtml = await page.content();

            // Check for challenge
            const pChallenge = detectChallenge(productHtml);
            if (pChallenge.blocked) {
              log('warn', `[Challenge] Product ${productCanonical}: ${pChallenge.reason}`);
              if (attempt < 3) {
                await page.waitForTimeout(3000); // Wait before retry
                continue;
              }
              progress.failed[productCanonical] = {
                attempts: 3,
                reason: pChallenge.reason,
                lastAttemptAt: new Date().toISOString(),
              };
              progress.stats.totalFailed++;
              await atomicSaveAfterAttempt(outputDir, progress, null);
              break;
            }

            // Extract basic metadata from the page
            const title = await page.title() || null;
            const priceText = await extractVisiblePrice(page);
            const sku = await extractSku(page, storeConfig);
            const mpn = await extractMpn(page);

            // Check identity dedup (SKU or MPN)
            const identityKey = sku || mpn;
            if (identityKey && progress.identityIndex[identityKey]) {
              log('info', `[Dedup] Identity duplicate (key=${identityKey}): ${productCanonical} — keeping first capture ${progress.identityIndex[identityKey]}`);
              progress.skipped[productCanonical] = {
                reason: `Identity duplicate of ${progress.identityIndex[identityKey]} (key=${identityKey})`,
              };
              progress.stats.totalSkipped++;
              await atomicSaveAfterAttempt(outputDir, progress, null);
              captured = true; // Mark as "handled" to break retry loop
              break;
            }

            // Save HTML file
            const filename = `${sanitizeFilename(productCanonical)}.html`;
            await writeFile(path.join(outputDir, 'products', filename), productHtml, 'utf-8');

            // Record completion
            const capturedAt = new Date().toISOString();
            progress.completed[productCanonical] = {
              htmlFile: filename,
              capturedAt,
              title,
              category: item.category,
              price: priceText,
              sku,
              mpn,
              source: 'browser-capture',
            };

            // Register identity in index
            if (identityKey) {
              progress.identityIndex[identityKey] = productCanonical;
            }

            progress.stats.totalProductsCaptured++;
            if (progress.categories[item.category]) {
              progress.categories[item.category].completed++;
            }

            // Append to products.ndjson
            await atomicSaveAfterAttempt(outputDir, progress, {
              url: productCanonical,
              title,
              category: item.category,
              price: priceText,
              sku,
              mpn,
              capturedAt,
              store: args.store,
              htmlFile: filename,
            });

            log('info', `[Captured] ${productCanonical} — title="${title}" price="${priceText}" sku="${sku}"`);
            captured = true;
            break;

          } catch (err) {
            log('error', `[Product] Attempt ${attempt}/3 failed for ${productCanonical}: ${err.message}`);
            if (attempt < 3) {
              await page.waitForTimeout(2000);
            }
          }
        }

        if (!captured && !progress.failed[productCanonical]) {
          progress.failed[productCanonical] = {
            attempts: 3,
            reason: 'All attempts failed',
            lastAttemptAt: new Date().toISOString(),
          };
          progress.stats.totalFailed++;
          await atomicSaveAfterAttempt(outputDir, progress, null);
        }
      }
    }

    // Mark discovery as completed when queue is exhausted (normal completion or --max-products limit)
    if (progress.queue.length === 0 && progress.discoveryState === 'seeded') {
      progress.discoveryState = 'completed';
    }

    // Final save
    await saveProgress(outputDir, progress);
    await saveManifest(outputDir, progress);

    log('info', '═══════════════════════════════════════════════════════════════');
    log('info', 'Capture complete!');
    log('info', `Store: ${args.store}`);
    log('info', `Products captured: ${progress.stats.totalProductsCaptured}`);
    log('info', `Pages visited: ${progress.stats.totalPagesVisited}`);
    log('info', `Failed: ${progress.stats.totalFailed}`);
    log('info', `Skipped: ${progress.stats.totalSkipped}`);
    log('info', `Output: ${outputDir}`);
    log('info', '═══════════════════════════════════════════════════════════════');

    return progress;

  } finally {
    await page.close();
    if (isOwnBrowser) {
      await context.close();
    }
    // If we launched the browser ourselves, close it too
    if (isOwnBrowser && browser) {
      await browser.close();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Metadata extraction helpers
// ═══════════════════════════════════════════════════════════════════════════════

async function extractVisiblePrice(page) {
  try {
    const price = await page.evaluate(() => {
      // Try common price selectors
      const selectors = [
        '.woocommerce-Price-amount',
        '.price .amount',
        'span.price',
        '.product-price',
        '[data-price]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.textContent?.trim();
          if (text && /\d/.test(text)) return text;
        }
      }
      return null;
    });
    return price;
  } catch {
    return null;
  }
}

async function extractSku(page, storeConfig) {
  try {
    return await page.evaluate((host) => {
      // Common SKU selectors
      const selectors = [
        'span.sku',
        '.product_meta .sku',
        '[itemprop="sku"]',
        'a.add_to_cart_button[data-product_sku]',
        '.wd-sku',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.getAttribute('data-product_sku') || el.textContent?.trim();
          if (text && text.length > 0) return text;
        }
      }
      return null;
    }, storeConfig.host);
  } catch {
    return null;
  }
}

async function extractMpn(page) {
  try {
    return await page.evaluate(() => {
      // Look for MPN in specs or meta
      const specRows = document.querySelectorAll('.woocommerce-product-attributes tr, .product-specifications tr, table.spec tr');
      for (const row of specRows) {
        const label = row.querySelector('th, td:first-child');
        const value = row.querySelector('td:last-child, td:nth-child(2)');
        if (label && value) {
          const labelText = label.textContent?.toLowerCase() || '';
          if (labelText.includes('mpn') || labelText.includes('model') || labelText.includes('part number')) {
            return value.textContent?.trim() || null;
          }
        }
      }
      return null;
    });
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Entry point (only when run directly, not when imported by tests)
// ═══════════════════════════════════════════════════════════════════════════════

const isMainModule = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const args = parseArgs();
  try {
    await capture(args);
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}
