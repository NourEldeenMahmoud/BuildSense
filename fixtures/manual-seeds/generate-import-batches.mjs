#!/usr/bin/env node
/**
 * Generate import batch manifests from existing captured HTML files.
 *
 * For each entry in a store's manifest.json:
 * 1. Read the HTML file
 * 2. Extract JSON-LD Product data (price, name, availability)
 * 3. Determine category from HTML body classes or posted_in meta
 * 4. Filter: supported categories only, valid positive price, not a bundle
 * 5. Group into batches of ≤50 with category variety
 * 6. Write batch manifests + audit JSON
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration ────────────────────────────────────────────────────────────

const SUPPORTED_CATEGORIES = new Set(['CPU', 'GPU', 'MOTHERBOARD', 'RAM', 'SSD', 'PSU', 'CASE', 'COOLING']);
const EXCLUDED_CATEGORIES = new Set(['MONITOR', 'HDD']);
const BATCH_SIZE = 50;

/**
 * WordPress/WooCommerce product_cat slug → BuildSense category.
 * Shared across stores since the slug convention is the same.
 */
const PRODUCT_CAT_SLUG_MAP = {
  'processors': 'CPU',
  'processor': 'CPU',
  'graphics-cards': 'GPU',
  'graphics-card': 'GPU',
  'motherboards': 'MOTHERBOARD',
  'motherboard': 'MOTHERBOARD',
  'ram': 'RAM',
  'ssd': 'SSD',
  'hdd': 'HDD',
  'power-supply': 'PSU',
  'pc-cases': 'CASE',
  'cases': 'CASE',
  'cooling': 'COOLING',
  'air-liquid-cooling': 'COOLING',
  'case-fans': 'COOLING',
  'monitors': 'MONITOR',
};

/**
 * WooCommerce category display name → BuildSense category.
 * Used as fallback from posted_in text.
 * Keys are LOWERCASE — the posted_in text is decoded and lowercased before lookup.
 */
const CATEGORY_NAME_MAP = {
  // CPU
  'cpu': 'CPU',
  'processor': 'CPU',
  'processors': 'CPU',

  // GPU
  'gpu': 'GPU',
  'vga': 'GPU',
  'vga cards': 'GPU',
  'graphics card': 'GPU',
  'graphics cards': 'GPU',

  // MOTHERBOARD
  'motherboard': 'MOTHERBOARD',
  'motherboards': 'MOTHERBOARD',
  'intel motherboards': 'MOTHERBOARD',
  'amd motherboards': 'MOTHERBOARD',

  // RAM
  'ram': 'RAM',
  'memory': 'RAM',
  'desktop ram': 'RAM',
  'desktop memory': 'RAM',

  // SSD
  'ssd': 'SSD',
  'ssd disk': 'SSD',
  'nvme': 'SSD',

  // HDD
  'hdd': 'HDD',
  'hdd disk': 'HDD',

  // PSU
  'power supply': 'PSU',
  'power supplies': 'PSU',

  // CASE
  'computer case': 'CASE',
  'pc case': 'CASE',
  'cases': 'CASE',
  'case': 'CASE',

  // COOLING
  'cooling': 'COOLING',
  'cooler': 'COOLING',
  'cpu cooler': 'COOLING',
  'air cooler': 'COOLING',
  'liquid cooler': 'COOLING',
  'air & liquid cooling': 'COOLING',
  'air &amp; liquid cooling': 'COOLING',
  'case fan': 'COOLING',
  'case fans': 'COOLING',

  // MONITOR (excluded)
  'monitor': 'MONITOR',
  'monitors': 'MONITOR',
  'display': 'MONITOR',
};

// ── Lightweight HTML Parser ──────────────────────────────────────────────────

function extractJsonLdProducts(html) {
  const products = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const graph = data['@graph'] || (data['@type'] === 'Product' ? [data] : null);
      if (!graph) continue;
      for (const node of graph) {
        if (node['@type'] === 'Product') {
          products.push(node);
        }
      }
    } catch { /* skip malformed */ }
  }
  return products;
}

function extractOfferPrice(product) {
  if (!product.offers) return null;
  const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
  for (const offer of offers) {
    if (offer['@type'] === 'AggregateOffer') {
      if (Array.isArray(offer.offers) && offer.offers.length === 1) {
        return extractOfferPrice(offer.offers[0]);
      }
      if (offer.priceSpecification && offer.priceSpecification.length > 0) {
        const spec = offer.priceSpecification[0];
        if (spec.price != null) {
          const p = typeof spec.price === 'string' ? parseFloat(spec.price) : spec.price;
          if (Number.isFinite(p) && p > 0) return p;
        }
      }
      if (offer.price != null) {
        const p = typeof offer.price === 'string' ? parseFloat(offer.price) : offer.price;
        if (Number.isFinite(p) && p > 0) return p;
      }
      continue;
    }
    if (offer.price != null) {
      const p = typeof offer.price === 'string' ? parseFloat(offer.price) : offer.price;
      if (Number.isFinite(p) && p > 0) return p;
    }
    if (offer.priceSpecification && offer.priceSpecification.length > 0) {
      const spec = offer.priceSpecification[0];
      if (spec.price != null) {
        const p = typeof spec.price === 'string' ? parseFloat(spec.price) : spec.price;
        if (Number.isFinite(p) && p > 0) return p;
      }
    }
  }
  return null;
}

function extractAvailability(product) {
  if (!product.offers) return null;
  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  return offer?.availability ?? null;
}

/**
 * Extract the product's own categories from the HTML.
 * Strategy 1: product_cat-* CSS classes on the main product div
 * Strategy 2: posted_in category link text
 * Strategy 3: Category name keywords from the page breadcrumb links
 */
function resolveCategoryFromHtml(html) {
  // Strategy 1: Extract product_cat-* from the main product container div
  // Pattern: class="...single-product-page... product_cat-XXXX ..."
  const mainProductDivMatch = html.match(
    /class="[^"]*single-product-page[^"]*(product_cat-\S+[^"]*)"/
  );
  if (mainProductDivMatch) {
    const classes = mainProductDivMatch[1];
    const catSlugs = [...classes.matchAll(/product_cat-(\S+)/g)].map(m => m[1]);
    // The most specific (last) category is usually the leaf
    // Check from most specific to least specific
    for (const slug of catSlugs.reverse()) {
      const mapped = PRODUCT_CAT_SLUG_MAP[slug.toLowerCase()];
      if (mapped) return mapped;
    }
    // Even if not in our map, check if it's a known non-supported category
    // to avoid treating unknown as "excluded"
  }

  // Strategy 2: posted_in category links text
  const postedInMatch = html.match(
    /<span[^>]*class="posted_in"[^>]*>([\s\S]*?)<\/span>/
  );
    if (postedInMatch) {
    const decoded = decodeHtmlEntities(postedInMatch[1]);
    const links = [...decoded.matchAll(/<a[^>]*>([^<]+)<\/a>/g)];
    for (const link of links.reverse()) {
      const name = link[1].trim().toLowerCase();
      const mapped = CATEGORY_NAME_MAP[name];
      if (mapped) return mapped;
    }
  }

  // Strategy 3: Breadcrumb link hrefs (from nav, not JSON-LD)
  // Look for breadcrumb links with category hrefs
  const breadcrumbLinks = [...html.matchAll(
    /<a[^>]*href="[^"]*\/product-category\/pc-parts\/(\S+)"[^>]*class="wd-last-link"/g
  )];
  if (breadcrumbLinks.length > 0) {
    const slug = breadcrumbLinks[0][1].replace(/\/$/, '').toLowerCase();
    const mapped = PRODUCT_CAT_SLUG_MAP[slug];
    if (mapped) return mapped;
  }

  return null;
}

/** Decode common HTML entities in text */
function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function isBundle(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower.includes('custom gaming pc') ||
    lower.includes('gaming pc build') ||
    lower.includes('bundle')
  );
}

function isCategoryPageUrl(url) {
  return url.includes('/product-category/') || url.includes('/page/');
}

// ── Main ─────────────────────────────────────────────────────────────────────

function processStore(storeDir, storeName, hostname) {
  const manifestPath = path.join(storeDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`[SKIP] ${storeName}: manifest.json not found at ${manifestPath}`);
    return null;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing ${storeName}: ${manifest.entries.length} manifest entries`);
  console.log(`${'='.repeat(60)}`);

  const candidates = [];
  const exclusionReasons = {};
  const exclusions = { categoryPage: 0, excludedCategory: 0, noCategory: 0, noPrice: 0, zeroPrice: 0, bundle: 0, parseError: 0, noProduct: 0, noName: 0 };

  for (const entry of manifest.entries) {
    // Skip category pages
    if (isCategoryPageUrl(entry.url) || entry.htmlFile.startsWith('_category_page')) {
      exclusions.categoryPage++;
      continue;
    }

    const htmlPath = path.join(storeDir, 'products', entry.htmlFile);
    if (!fs.existsSync(htmlPath)) {
      exclusions.parseError++;
      continue;
    }

    let html;
    try {
      html = fs.readFileSync(htmlPath, 'utf-8');
    } catch {
      exclusions.parseError++;
      continue;
    }

    // Extract JSON-LD products
    const products = extractJsonLdProducts(html);
    if (products.length === 0) {
      exclusions.noProduct++;
      continue;
    }

    const product = products[0];
    const name = product.name || null;
    if (!name) {
      exclusions.noName++;
      continue;
    }

    if (isBundle(name)) {
      exclusions.bundle++;
      continue;
    }

    // Determine category from HTML
    const category = resolveCategoryFromHtml(html);

    if (!category) {
      exclusions.noCategory++;
      continue;
    }
    if (EXCLUDED_CATEGORIES.has(category)) {
      exclusions.excludedCategory++;
      continue;
    }
    if (!SUPPORTED_CATEGORIES.has(category)) {
      exclusions.excludedCategory++;
      exclusionReasons[category] = (exclusionReasons[category] || 0) + 1;
      continue;
    }

    // Extract price
    const price = extractOfferPrice(product);
    if (price === null) {
      exclusions.noPrice++;
      continue;
    }
    if (price <= 0) {
      exclusions.zeroPrice++;
      continue;
    }

    // Extract availability
    const avail = extractAvailability(product);
    const isInStock = avail ? avail.includes('InStock') : null;

    candidates.push({
      entry,
      name,
      category,
      price,
      inStock: isInStock,
    });
  }

  console.log(`\nCandidates after filtering: ${candidates.length}`);
  console.log('Exclusions:', exclusions);
  if (Object.keys(exclusionReasons).length > 0) {
    console.log('Unmapped categories:', exclusionReasons);
  }

  // Round-robin selection for variety (IN_STOCK first within each category)
  const byCategory = {};
  for (const c of candidates) {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  }

  // Sort within each category: IN_STOCK first, then price ascending
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => {
      if (a.inStock !== b.inStock) {
        if (a.inStock === true) return -1;
        if (b.inStock === true) return 1;
      }
      return a.price - b.price;
    });
  }

  const roundRobin = [];
  const cats = Object.keys(byCategory).sort();
  let idx = 0;
  const maxIterations = cats.length * Math.max(...cats.map(c => byCategory[c].length), 1) + cats.length;
  while (roundRobin.length < candidates.length && idx < maxIterations) {
    const cat = cats[idx % cats.length];
    if (byCategory[cat].length > 0) {
      roundRobin.push(byCategory[cat].shift());
    }
    idx++;
  }

  // Generate batches
  const batches = [];
  for (let i = 0; i < roundRobin.length; i += BATCH_SIZE) {
    batches.push(roundRobin.slice(i, i + BATCH_SIZE));
  }

  console.log(`\nBatches: ${batches.length}`);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const catCounts = {};
    for (const c of batch) {
      catCounts[c.category] = (catCounts[c.category] || 0) + 1;
    }
    console.log(`  Batch ${i + 1}: ${batch.length} entries — ${JSON.stringify(catCounts)}`);
  }

  // Write batch manifests
  const writtenBatches = [];
  for (let i = 0; i < batches.length; i++) {
    const batchNum = String(i + 1).padStart(2, '0');
    const batchFile = `import-batch-${batchNum}.json`;
    const batchPath = path.join(storeDir, batchFile);

    const batchManifest = {
      entries: batches[i].map(c => ({
        url: c.entry.url,
        htmlFile: `products/${c.entry.htmlFile}`,
        capturedAt: c.entry.capturedAt,
      })),
    };

    fs.writeFileSync(batchPath, JSON.stringify(batchManifest, null, 2), 'utf-8');
    console.log(`  Written: ${batchFile} (${batches[i].length} entries)`);
    writtenBatches.push({
      file: batchFile,
      count: batches[i].length,
      categories: (() => {
        const counts = {};
        for (const c of batches[i]) counts[c.category] = (counts[c.category] || 0) + 1;
        return counts;
      })(),
    });
  }

  // Write audit JSON
  const audit = {
    store: storeName,
    hostname,
    generatedAt: new Date().toISOString(),
    totalManifestEntries: manifest.entries.length,
    filteredCandidates: candidates.length,
    totalBatchEntries: roundRobin.length,
    batches: writtenBatches,
    exclusions,
    exclusionReasons,
    categoryBreakdown: (() => {
      const counts = {};
      for (const c of candidates) counts[c.category] = (counts[c.category] || 0) + 1;
      return counts;
    })(),
  };

  const auditPath = path.join(storeDir, 'import-audit.json');
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2), 'utf-8');
  console.log(`  Audit written: import-audit.json`);

  return audit;
}

// ── Run ──────────────────────────────────────────────────────────────────────

const elNourDir = path.join(__dirname, 'el-nour-tech', '2026-07-18');
const alfrensiaDir = path.join(__dirname, 'alfrensia', '2026-07-18');

const elNourAudit = processStore(elNourDir, 'el-nour-tech', 'elnour-tech.com');
const alfrensiaAudit = processStore(alfrensiaDir, 'alfrensia', 'alfrensia.com');

// Summary
console.log(`\n${'='.repeat(60)}`);
console.log('SUMMARY');
console.log(`${'='.repeat(60)}`);

let totalOffers = 0;
if (elNourAudit) {
  console.log(`El Nour: ${elNourAudit.filteredCandidates} candidates → ${elNourAudit.totalBatchEntries} batch entries in ${elNourAudit.batches.length} batches`);
  console.log(`  Category breakdown: ${JSON.stringify(elNourAudit.categoryBreakdown)}`);
  totalOffers += elNourAudit.totalBatchEntries;
}
if (alfrensiaAudit) {
  console.log(`Alfrensia: ${alfrensiaAudit.filteredCandidates} candidates → ${alfrensiaAudit.totalBatchEntries} batch entries in ${alfrensiaAudit.batches.length} batches`);
  console.log(`  Category breakdown: ${JSON.stringify(alfrensiaAudit.categoryBreakdown)}`);
  totalOffers += alfrensiaAudit.totalBatchEntries;
}
console.log(`\nTotal new offers: ${totalOffers}`);
console.log(`Existing El Badr offers: 1`);
console.log(`Grand total: ${totalOffers + 1}`);
