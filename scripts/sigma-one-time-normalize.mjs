#!/usr/bin/env node
/**
 * sigma-one-time-normalize.mjs
 *
 * One-time fast-track normalizer.
 * Reads data/bootstrap/sigma-products.json and maps to the catalog/offer schema format.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(ROOT, 'data', 'bootstrap', 'sigma-products.json');
const OUTPUT_PRODUCTS = path.join(ROOT, 'data', 'bootstrap', 'normalized-products.json');
const OUTPUT_ERRORS = path.join(ROOT, 'data', 'bootstrap', 'normalization-errors.json');
const OUTPUT_MANIFEST = path.join(ROOT, 'data', 'bootstrap', 'normalization-manifest.json');

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await fileExists(INPUT_PATH))) {
    console.error(`Input file not found: ${INPUT_PATH}`);
    process.exitCode = 1;
    return;
  }

  const rawData = await fs.readFile(INPUT_PATH, 'utf-8');
  const products = JSON.parse(rawData);

  const normalized = [];
  const errors = [];

  for (const p of products) {
    try {
      if (!p.title) throw new Error('Missing title');
      if (!p.category) throw new Error('Missing category');
      
      const externalId = p.sigmaUuid || p.sourceUrl;
      if (!externalId) throw new Error('Missing unique identifier (sigmaUuid or sourceUrl)');

      const availStr = String(p.availability || '').toUpperCase();
      let availability = 'UNKNOWN';
      if (availStr === 'TRUE' || availStr === 'IN STOCK' || availStr === 'INSTOCK' || availStr === '1') {
        availability = 'IN_STOCK';
      } else if (availStr === 'FALSE' || availStr === 'OUT OF STOCK' || availStr === 'OUTOFSTOCK' || availStr === '0') {
        availability = 'OUT_OF_STOCK';
      }
      
      let price = null;
      if (typeof p.priceValue === 'number') {
        price = p.priceValue;
      } else if (typeof p.priceValue === 'string') {
        const parsed = parseFloat(p.priceValue.replace(/,/g, ''));
        if (!isNaN(parsed)) price = parsed;
      }

      normalized.push({
        externalId,
        sourceUrl: p.sourceUrl,
        title: p.title,
        category: p.category,
        brand: p.brandText || null,
        model: null, 
        mpn: p.skuText || null,
        price,
        currency: p.currency || 'EGP',
        availability,
        images: Array.isArray(p.imageUrls) ? p.imageUrls : [],
        rawSpecifications: Array.isArray(p.specifications) ? p.specifications : [],
      });
    } catch (err) {
      errors.push({
        url: p.sourceUrl,
        error: err.message,
        rawProduct: p
      });
    }
  }

  await fs.writeFile(OUTPUT_PRODUCTS, JSON.stringify(normalized, null, 2), 'utf-8');
  await fs.writeFile(OUTPUT_ERRORS, JSON.stringify(errors, null, 2), 'utf-8');

  const manifest = {
    totalRaw: products.length,
    totalNormalized: normalized.length,
    totalFailed: errors.length,
    timestamp: new Date().toISOString()
  };

  await fs.writeFile(OUTPUT_MANIFEST, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('═══════════════════════════════════════════════════');
  console.log('  BuildSense — Sigma Fast-track Normalization');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Raw input  : ${manifest.totalRaw}`);
  console.log(`  Normalized : ${manifest.totalNormalized}`);
  console.log(`  Failed     : ${manifest.totalFailed}`);
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal normalization error:', err);
  process.exit(1);
});
