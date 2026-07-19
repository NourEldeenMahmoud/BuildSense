#!/usr/bin/env tsx
/**
 * Generate mvp-import-batch-02.json from the manifest.
 * 
 * Step 1: Analyze batch 01 to determine skip reasons
 * Step 2: Select 40 NEW candidates not in batch 01 (PSU/CASE/COOLING, positive price)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ManifestEntry {
  url: string;
  htmlFile: string;
  capturedAt: string;
}

interface Manifest {
  entries: ManifestEntry[];
}

interface Candidate {
  url: string;
  htmlFile: string;
  capturedAt: string;
  category: string;
  priceText: string;
  availabilityText: string;
  title: string;
}

const SUPPORTED_CATEGORIES = new Set(['PSU', 'CASE', 'COOLING']);

const CATEGORY_MAP: Record<string, string> = {
  'power supply': 'PSU',
  'cases': 'CASE',
  'air & liquid cooling': 'COOLING',
  'air liquid cooling': 'COOLING',
};

function parseFixedPrice(priceText: string | null): number | null {
  if (priceText == null) return null;
  const isNegative = priceText.includes('-');
  const cleaned = priceText.replace(/[^0-9.]/g, '').trim();
  if (cleaned.length === 0) return null;
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (isNegative) return null;
  return num;
}

function extractCategoryFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');
  
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;
    
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;
      
      const obj = parsed as Record<string, unknown>;
      let graph: Array<Record<string, unknown>> | null = null;
      
      if (Array.isArray(obj['@graph'])) {
        graph = obj['@graph'] as Array<Record<string, unknown>>;
      } else if (typeof obj['@type'] === 'string') {
        graph = [obj];
      }
      
      if (!graph) continue;
      
      for (const node of graph) {
        if (node['@type'] === 'BreadcrumbList' && 'itemListElement' in node) {
          const items = node['itemListElement'] as Array<{
            position: number;
            name?: string;
            item?: string | { name: string; '@id': string };
          }>;
          
          for (const item of items) {
            let label = '';
            if (typeof item.item === 'string') {
              label = item.name ?? item.item;
            } else if (item.item && typeof item.item === 'object') {
              label = item.item.name;
            } else if (item.name) {
              label = item.name;
            }
            
            const upper = label.trim().toUpperCase();
            
            if (upper.includes('POWER SUPPLY') || upper.includes('PSU')) {
              return 'PSU';
            }
            if (upper.includes('CASE') && !upper.includes('CASE FAN')) {
              return 'CASE';
            }
            if (upper.includes('COOLING') || upper.includes('COOLER') || upper.includes('LIQUID')) {
              return 'COOLING';
            }
          }
        }
      }
    } catch {
      // Skip malformed JSON-LD
    }
  }
  
  return null;
}

function extractPriceFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');
  
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;
    
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;
      
      const obj = parsed as Record<string, unknown>;
      let graph: Array<Record<string, unknown>> | null = null;
      
      if (Array.isArray(obj['@graph'])) {
        graph = obj['@graph'] as Array<Record<string, unknown>>;
      } else if (typeof obj['@type'] === 'string') {
        graph = [obj];
      }
      
      if (!graph) continue;
      
      for (const node of graph) {
        if (node['@type'] === 'Product') {
          const offers = node.offers;
          if (!offers) continue;
          
          const offer = Array.isArray(offers) ? offers[0] : offers;
          if (!offer || typeof offer !== 'object') continue;
          
          const offerObj = offer as Record<string, unknown>;
          if (offerObj.price != null) {
            const priceNum = typeof offerObj.price === 'string' 
              ? parseFloat(offerObj.price) 
              : offerObj.price as number;
            
            if (Number.isFinite(priceNum) && priceNum > 0) {
              return String(priceNum);
            }
          }
        }
      }
    } catch {
      // Skip malformed JSON-LD
    }
  }
  
  return null;
}

function extractAvailabilityFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  
  const stockEl = $('p.stock, .stock');
  if (stockEl.length > 0) {
    const text = stockEl.text().trim();
    if (text) return text;
  }
  
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;
    
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;
      
      const obj = parsed as Record<string, unknown>;
      let graph: Array<Record<string, unknown>> | null = null;
      
      if (Array.isArray(obj['@graph'])) {
        graph = obj['@graph'] as Array<Record<string, unknown>>;
      } else if (typeof obj['@type'] === 'string') {
        graph = [obj];
      }
      
      if (!graph) continue;
      
      for (const node of graph) {
        if (node['@type'] === 'Product') {
          const offers = node.offers;
          if (!offers) continue;
          
          const offer = Array.isArray(offers) ? offers[0] : offers;
          if (!offer || typeof offer !== 'object') continue;
          
          const offerObj = offer as Record<string, unknown>;
          if (typeof offerObj.availability === 'string') {
            const avail = offerObj.availability;
            if (avail.includes('InStock')) return 'In Stock';
            if (avail.includes('OutOfStock')) return 'Out of Stock';
            return avail;
          }
        }
      }
    } catch {
      // Skip malformed JSON-LD
    }
  }
  
  return null;
}

function extractTitleFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const title = $('h1.product_title, h1.entry-title').text().trim();
  if (title) return title;
  const h1 = $('h1').text().trim();
  return h1 || null;
}

/**
 * Extract WordPress post ID (used as externalId by adapter).
 * If missing, the publisher will return EMPTY_EXTERNAL_ID.
 */
function extractWordPressPostId(html: string): string | null {
  const $ = cheerio.load(html);
  const bodyClass = $('body').attr('class') ?? '';
  const match = bodyClass.match(/\bpostid-(\d+)\b/);
  return match?.[1] ?? null;
}

async function analyzeBatch01SkipReasons(
  batch01Entries: ManifestEntry[],
  productsDir: string,
): Promise<{ skipped: Array<{ url: string; reason: string }>; published: string[] }> {
  const skipped: Array<{ url: string; reason: string }> = [];
  const published: string[] = [];
  
  for (const entry of batch01Entries) {
    // Resolve HTML file path - manifest entries may or may not include "products/" prefix
    const htmlPath = entry.htmlFile.startsWith('products/')
      ? path.resolve(__dirname, entry.htmlFile)
      : path.join(productsDir, entry.htmlFile);
    let html: string;
    try {
      html = await fs.readFile(htmlPath, 'utf-8');
    } catch {
      skipped.push({ url: entry.url, reason: 'HTML_FILE_NOT_FOUND' });
      continue;
    }
    
    const category = extractCategoryFromHtml(html);
    const priceText = extractPriceFromHtml(html);
    const price = parseFixedPrice(priceText);
    const availabilityText = extractAvailabilityFromHtml(html);
    const title = extractTitleFromHtml(html);
    const wordpressPostId = extractWordPressPostId(html);
    
    const reasons: string[] = [];
    
    if (!category || !SUPPORTED_CATEGORIES.has(category)) {
      reasons.push(`UNSUPPORTED_CATEGORY:${category}`);
    }
    if (!title || title.trim().length === 0) {
      reasons.push('EMPTY_TITLE');
    }
    if (wordpressPostId === null) {
      reasons.push('EMPTY_EXTERNAL_ID');
    }
    if (price === null || price <= 0) {
      reasons.push(`INVALID_PRICE:${priceText ?? 'null'}`);
    }
    if (!availabilityText || availabilityText.trim().length === 0) {
      reasons.push('EMPTY_AVAILABILITY');
    }
    
    if (reasons.length > 0) {
      skipped.push({ url: entry.url, reason: reasons.join('; ') });
    } else {
      published.push(entry.url);
    }
  }
  
  return { skipped, published };
}

async function main() {
  const manifestPath = path.resolve(__dirname, 'manifest.json');
  const productsDir = path.resolve(__dirname, 'products');
  const batch01Path = path.resolve(__dirname, 'mvp-import-batch-01.json');
  const outputPath = path.resolve(__dirname, 'mvp-import-batch-02.json');

  console.log('=== STEP 1: Analyze batch 01 skip reasons ===');
  const batch01Raw = await fs.readFile(batch01Path, 'utf-8');
  const batch01: Manifest = JSON.parse(batch01Raw);
  const batch01Urls = new Set(batch01.entries.map(e => e.url));
  
  const analysis = await analyzeBatch01SkipReasons(batch01.entries, productsDir);
  console.log(`Batch 01: ${analysis.published.length} would publish, ${analysis.skipped.length} would skip`);
  for (const s of analysis.skipped) {
    console.log(`  SKIP: ${s.url.split('/product/')[1]?.replace(/\/$/, '')} → ${s.reason}`);
  }
  
  console.log('\n=== STEP 2: Generate batch 02 ===');
  console.log('Reading manifest...');
  const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);
  console.log(`Manifest has ${manifest.entries.length} entries`);

  const candidates: Candidate[] = [];
  let processed = 0;
  let skippedCount = 0;

  for (const entry of manifest.entries) {
    processed++;
    if (processed % 200 === 0) {
      console.log(`Processed ${processed}/${manifest.entries.length}...`);
    }

    // Skip batch 01 URLs
    if (batch01Urls.has(entry.url)) continue;

    // Resolve HTML file path - manifest entries may or may not include "products/" prefix
    const htmlPath = entry.htmlFile.startsWith('products/')
      ? path.resolve(__dirname, entry.htmlFile)
      : path.join(productsDir, entry.htmlFile);
    let html: string;
    try {
      html = await fs.readFile(htmlPath, 'utf-8');
    } catch {
      skippedCount++;
      continue;
    }

    const category = extractCategoryFromHtml(html);
    if (!category || !SUPPORTED_CATEGORIES.has(category)) {
      skippedCount++;
      continue;
    }

    const priceText = extractPriceFromHtml(html);
    const price = parseFixedPrice(priceText);
    if (price === null || price <= 0) {
      skippedCount++;
      continue;
    }

    const availabilityText = extractAvailabilityFromHtml(html);
    if (!availabilityText || availabilityText.trim().length === 0) {
      skippedCount++;
      continue;
    }

    const title = extractTitleFromHtml(html);
    if (!title || title.trim().length === 0) {
      skippedCount++;
      continue;
    }

    // Check WordPress post ID (adapter uses this as externalId)
    const wordpressPostId = extractWordPressPostId(html);
    if (wordpressPostId === null) {
      skippedCount++;
      continue;
    }

    candidates.push({
      url: entry.url,
      htmlFile: entry.htmlFile,
      capturedAt: entry.capturedAt,
      category,
      priceText: priceText!,
      availabilityText,
      title,
    });
  }

  console.log(`Found ${candidates.length} candidates (${skippedCount} skipped, ${batch01Urls.size} batch-01 excluded)`);

  // Group by category
  const byCategory: Record<string, Candidate[]> = {
    PSU: [],
    CASE: [],
    COOLING: [],
  };

  for (const c of candidates) {
    byCategory[c.category].push(c);
  }

  console.log(`PSU: ${byCategory.PSU.length}, CASE: ${byCategory.CASE.length}, COOLING: ${byCategory.COOLING.length}`);

  // Select balanced batch of 40: 14 PSU, 13 CASE, 13 COOLING
  const TARGET = 40;
  const PSU_COUNT = 14;
  const CASE_COUNT = 13;
  const COOLING_COUNT = 13;

  // Deterministic shuffle (seed by index) to avoid randomness issues
  for (const cat of Object.keys(byCategory)) {
    const arr = byCategory[cat];
    // Fisher-Yates with index-based pseudo-random for determinism
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor((i * 2654435761) >>> 0) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  const selected: Candidate[] = [];
  selected.push(...byCategory.PSU.slice(0, PSU_COUNT));
  selected.push(...byCategory.CASE.slice(0, CASE_COUNT));
  selected.push(...byCategory.COOLING.slice(0, COOLING_COUNT));

  console.log(`Selected ${selected.length} items for MVP batch 02`);

  // Verify no duplicates with batch 01
  const overlap = selected.filter(s => batch01Urls.has(s.url));
  if (overlap.length > 0) {
    console.error(`ERROR: ${overlap.length} items overlap with batch 01!`);
    process.exit(1);
  }

  // Verify no duplicate URLs within batch 02
  const urls = selected.map(s => s.url);
  const uniqueUrls = new Set(urls);
  if (uniqueUrls.size !== urls.length) {
    console.error(`ERROR: ${urls.length - uniqueUrls.size} duplicate URLs in batch 02!`);
    process.exit(1);
  }

  // Write output
  const output = {
    entries: selected.map((c) => ({
      url: c.url,
      htmlFile: `products/${c.htmlFile}`,
      capturedAt: c.capturedAt,
    })),
  };

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Written to ${outputPath}`);

  // Print summary
  const summary = {
    total: selected.length,
    categories: {
      PSU: selected.filter((c) => c.category === 'PSU').length,
      CASE: selected.filter((c) => c.category === 'CASE').length,
      COOLING: selected.filter((c) => c.category === 'COOLING').length,
    },
    allCandidates: {
      PSU: byCategory.PSU.length,
      CASE: byCategory.CASE.length,
      COOLING: byCategory.COOLING.length,
    },
    batch01SkipAnalysis: {
      predictedSkips: analysis.skipped.length,
      predictedPublishes: analysis.published.length,
      skipReasons: analysis.skipped.map(s => ({
        url: s.url.split('/product/')[1]?.replace(/\/$/, ''),
        reason: s.reason,
      })),
    },
  };

  console.log('Summary:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
