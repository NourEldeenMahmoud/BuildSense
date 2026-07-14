#!/usr/bin/env node
/**
 * sigma-one-time-publish.mjs
 *
 * One-time fast-track publisher to MongoDB.
 * Reads data/bootstrap/normalized-products.json and upserts CatalogProduct and Offer models.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(ROOT, 'data', 'bootstrap', 'normalized-products.json');
const DATABASE_DIST = path.join(ROOT, 'packages', 'database', 'dist');
const OUTPUT_MANIFEST = path.join(ROOT, 'data', 'bootstrap', 'publish-manifest.json');

async function main() {
  // Load compiled mongoose models from database package
  const { CatalogProductModel, OfferModel } = await import(
    pathToFileURL(path.join(DATABASE_DIST, 'index.js')).href
  );

  const rawData = await fs.readFile(INPUT_PATH, 'utf-8');
  const products = JSON.parse(rawData);

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/buildsense';
  console.log(`Connecting to MongoDB at ${mongoUri}`);
  await mongoose.connect(mongoUri);

  let published = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      let offer = await OfferModel.findOne({ storeCode: 'SIGMA', storeExternalId: p.externalId });
      
      let catalogProductId;
      
      if (offer) {
        catalogProductId = offer.catalogProductId;
        await CatalogProductModel.findByIdAndUpdate(catalogProductId, {
          title: p.title,
          category: p.category,
          brand: p.brand,
          model: p.model,
          mpn: p.mpn,
          images: p.images,
          rawSpecifications: p.rawSpecifications,
          compatibility: {}
        });
      } else {
        const product = await CatalogProductModel.create({
          title: p.title,
          category: p.category,
          brand: p.brand,
          model: p.model,
          mpn: p.mpn,
          images: p.images,
          rawSpecifications: p.rawSpecifications,
          compatibility: {}
        });
        catalogProductId = product._id;
      }

      await OfferModel.findOneAndUpdate(
        { storeCode: 'SIGMA', storeExternalId: p.externalId },
        {
          catalogProductId,
          storeCode: 'SIGMA',
          storeExternalId: p.externalId,
          sourceUrl: p.sourceUrl,
          price: p.price,
          currency: p.currency,
          availability: p.availability
        },
        { upsert: true, new: true }
      );
      
      published++;
    } catch (err) {
      failed++;
      errors.push({
        externalId: p.externalId,
        error: err.message
      });
    }
  }

  await mongoose.disconnect();

  const manifest = {
    totalInput: products.length,
    totalPublished: published,
    totalFailed: failed,
    errors,
    timestamp: new Date().toISOString()
  };

  await fs.writeFile(OUTPUT_MANIFEST, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('═══════════════════════════════════════════════════');
  console.log('  BuildSense — Sigma Fast-track Publishing');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Input      : ${manifest.totalInput}`);
  console.log(`  Published  : ${manifest.totalPublished}`);
  console.log(`  Failed     : ${manifest.totalFailed}`);
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal publish error:', err);
  process.exit(1);
});
