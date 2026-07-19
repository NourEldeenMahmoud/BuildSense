#!/usr/bin/env tsx
/**
 * Generate mvp-import-batch-01.json from the manifest.
 * 
 * This script:
 * 1. Reads manifest.json
 * 2. Parses each HTML file to extract price, availability, and category
 * 3. Filters for positive prices and supported categories (PSU, CASE, COOLING)
 * 4. Selects 50 balanced items (17 PSU, 17 CASE, 16 COOLING)
 * 5. Writes to mvp-import-batch-01.json
 * 
 * Category detection: Extracts from the SECOND JSON-LD BreadcrumbList which
 * contains the actual category (e.g., "Home > Monitors > Product Name"),
 * unlike the first Yoast SEO breadcrumb which only has "Home > Shop > Product".
 * 
 * Usage: npx tsx generate-mvp-batch.ts
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

// Category slug from breadcrumb to display category mapping
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

/**
 * Extract category from the SECOND JSON-LD BreadcrumbList.
 * The first is Yoast SEO (Home > Shop > Product), the second has the actual category.
 */
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
          
          // Extract category from breadcrumbs (position 2 = category)
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
            
            // Check if this matches a supported category
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

/**
 * Extract price from JSON-LD offers.
 */
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

/**
 * Extract availability from HTML (visible stock element or JSON-LD).
 */
function extractAvailabilityFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  
  // Try visible stock element first
  const stockEl = $('p.stock, .stock');
  if (stockEl.length > 0) {
    const text = stockEl.text().trim();
    if (text) return text;
  }
  
  // Fall back to JSON-LD
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

/**
 * Extract title from HTML.
 */
function extractTitleFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  
  // WordPress/WooCommerce uses h1.product_title or just h1
  const title = $('h1.product_title, h1.entry-title').text().trim();
  if (title) return title;
  
  // Fallback to h1
  const h1 = $('h1').text().trim();
  return h1 || null;
}

async function main() {
  const manifestPath = path.resolve(__dirname, 'manifest.json');
  const productsDir = path.resolve(__dirname, 'products');
  const outputPath = path.resolve(__dirname, 'mvp-import-batch-01.json');

  console.log('Reading manifest...');
  const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  console.log(`Manifest has ${manifest.entries.length} entries`);

  const candidates: Candidate[] = [];
  let processed = 0;
  let skipped = 0;
  let categoryFound = 0;
  let priceFound = 0;

  for (const entry of manifest.entries) {
    processed++;
    if (processed % 100 === 0) {
      console.log(`Processed ${processed}/${manifest.entries.length}...`);
    }

    // Resolve HTML file path
    const htmlPath = path.join(productsDir, entry.htmlFile);
    let html: string;
    try {
      html = await fs.readFile(htmlPath, 'utf-8');
    } catch (err) {
      skipped++;
      continue;
    }

    // Extract category from HTML breadcrumbs
    const category = extractCategoryFromHtml(html);
    if (!category || !SUPPORTED_CATEGORIES.has(category)) {
      skipped++;
      continue;
    }
    categoryFound++;

    // Extract price from HTML
    const priceText = extractPriceFromHtml(html);
    const price = parseFixedPrice(priceText);
    if (price === null || price <= 0) {
      skipped++;
      continue;
    }
    priceFound++;

    // Extract availability
    const availabilityText = extractAvailabilityFromHtml(html);
    if (!availabilityText || availabilityText.trim().length === 0) {
      skipped++;
      continue;
    }

    // Extract title
    const title = extractTitleFromHtml(html);
    if (!title || title.trim().length === 0) {
      skipped++;
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

  console.log(`Found ${candidates.length} candidates (${skipped} skipped)`);
  console.log(`Category found: ${categoryFound}, Price found: ${priceFound}`);

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

  // Select balanced batch
  const TARGET = 50;
  const PSU_COUNT = 17;
  const CASE_COUNT = 17;
  const COOLING_COUNT = 16;

  const selected: Candidate[] = [];

  // Shuffle each category
  for (const cat of Object.keys(byCategory)) {
    const arr = byCategory[cat];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // Select from each category
  selected.push(...byCategory.PSU.slice(0, PSU_COUNT));
  selected.push(...byCategory.CASE.slice(0, CASE_COUNT));
  selected.push(...byCategory.COOLING.slice(0, COOLING_COUNT));

  console.log(`Selected ${selected.length} items for MVP batch`);

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
  };

  console.log('Summary:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
