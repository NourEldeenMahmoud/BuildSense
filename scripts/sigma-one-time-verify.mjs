#!/usr/bin/env node
/**
 * sigma-one-time-verify.mjs
 *
 * One-time fast-track pipeline verifier.
 * Checks manifests and MongoDB counts.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BOOTSTRAP_DIR = path.join(ROOT, 'data', 'bootstrap');
const DATABASE_DIST = path.join(ROOT, 'packages', 'database', 'dist');

async function main() {
  const { CatalogProductModel, OfferModel } = await import(
    pathToFileURL(path.join(DATABASE_DIST, 'index.js')).href
  );

  console.log('═══════════════════════════════════════════════════');
  console.log('  BuildSense — Fast-track Pipeline Verification');
  console.log('═══════════════════════════════════════════════════');

  const importManifestPath = path.join(BOOTSTRAP_DIR, 'sigma-import-manifest.json');
  const normManifestPath = path.join(BOOTSTRAP_DIR, 'normalization-manifest.json');
  const pubManifestPath = path.join(BOOTSTRAP_DIR, 'publish-manifest.json');

  const [importStr, normStr, pubStr] = await Promise.all([
    fs.readFile(importManifestPath, 'utf-8').catch(() => null),
    fs.readFile(normManifestPath, 'utf-8').catch(() => null),
    fs.readFile(pubManifestPath, 'utf-8').catch(() => null)
  ]);

  if (!importStr || !normStr || !pubStr) {
    console.error('Missing one or more manifest files. Has the full pipeline run?');
    process.exitCode = 1;
    return;
  }

  const importData = JSON.parse(importStr);
  const normData = JSON.parse(normStr);
  const pubData = JSON.parse(pubStr);

  let success = true;

  console.log('1. Checking JSON integrity & silent skips...');
  const expectedNormalized = importData.fetch.successful;
  if (normData.totalRaw !== expectedNormalized) {
    console.error(`❌ Normalization input (${normData.totalRaw}) != Import success (${expectedNormalized})`);
    success = false;
  } else {
    console.log(`✅ Normalization input matches import success (${normData.totalRaw})`);
  }

  const expectedPublished = normData.totalNormalized;
  if (pubData.totalInput !== expectedPublished) {
    console.error(`❌ Publish input (${pubData.totalInput}) != Normalization success (${expectedPublished})`);
    success = false;
  } else {
    console.log(`✅ Publish input matches normalization success (${pubData.totalInput})`);
  }

  console.log('\n2. Checking MongoDB...');
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/buildsense';
  await mongoose.connect(mongoUri);

  const offerCount = await OfferModel.countDocuments({ storeCode: 'SIGMA' });
  if (offerCount < expectedPublished) {
    console.error(`❌ MongoDB Offer count (${offerCount}) < Expected (${expectedPublished})`);
    success = false;
  } else {
    console.log(`✅ MongoDB Offer count matches expected (${offerCount})`);
  }

  const productCount = await CatalogProductModel.countDocuments();
  if (productCount < expectedPublished) {
    console.error(`❌ MongoDB CatalogProduct count (${productCount}) < Expected (${expectedPublished})`);
    success = false;
  } else {
    console.log(`✅ MongoDB CatalogProduct count looks valid (${productCount})`);
  }

  const orphans = await OfferModel.find({ catalogProductId: null }).countDocuments();
  if (orphans > 0) {
    console.error(`❌ Found ${orphans} orphan offers without a CatalogProduct`);
    success = false;
  } else {
    console.log('✅ No orphan offers');
  }

  await mongoose.disconnect();

  console.log('═══════════════════════════════════════════════════');
  if (success) {
    console.log('  PIPELINE_READY: Catalog data is ready for API/UI.');
  } else {
    console.log('  PIPELINE_FAILED: Verification failed.');
    process.exitCode = 1;
  }
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal verify error:', err);
  process.exit(1);
});
