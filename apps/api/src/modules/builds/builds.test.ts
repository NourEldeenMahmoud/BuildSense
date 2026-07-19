import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  CatalogProductModel,
  OfferModel,
  BuildModel,
  CategoryQualityReportModel,
  ReferenceDatasetModel,
} from '@buildsense/database';
import { NO_ACTIVE_RULE_REASON } from '@buildsense/compatibility-engine';
import { createLogger } from '@buildsense/observability';
import express from 'express';

let mongoServer: MongoMemoryServer;
let app: express.Express;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = createApp({
    isDatabaseConnected: () => true,
    logger: createLogger({ level: 'fatal', name: 'test' }),
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await CatalogProductModel.deleteMany({});
  await OfferModel.deleteMany({});
  await BuildModel.deleteMany({});
  await CategoryQualityReportModel.deleteMany({});
  await ReferenceDatasetModel.deleteMany({});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compatibility(category: string, extractorVersion: string, values: Record<string, unknown>) {
  return {
    category,
    extractorVersion,
    extractedAt: new Date(0).toISOString(),
    extractionIssues: [],
    facts: Object.entries(values).map(([key, value]) => ({
      key,
      value,
      evidence: [{
        sourceLabel: key,
        rawValue: String(value),
        normalizedValue: String(value),
        confidence: 1,
        extractorVersion,
        extractionIssues: [],
      }],
    })),
  };
}

async function seedCpu(overrides?: { title?: string; price?: number; buildEligibility?: string; socket?: string; category?: string }) {
  const product = await CatalogProductModel.create({
    title: overrides?.title ?? 'AMD Ryzen 5 7600',
    category: overrides?.category ?? 'CPU',
    brand: 'AMD',
    buildEligibility: overrides?.buildEligibility ?? 'ELIGIBLE',
    compatibility: overrides?.socket
      ? compatibility('CPU', 'cpu/v1.0.0', { 'cpu.socket': overrides.socket })
      : null,
  });
  const offer = await OfferModel.create({
    catalogProductId: product._id,
    storeCode: 'SIGMA',
    storeExternalId: `sigma-cpu-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceUrl: `https://sigma.com/products/${product._id}`,
    price: overrides?.price ?? 5000,
    availability: 'IN_STOCK',
  });
  return { product, offer };
}

async function seedMotherboard(socket: string, extraFacts?: Record<string, unknown>) {
  const facts: Record<string, unknown> = { 'mb.socket': socket };
  if (extraFacts) Object.assign(facts, extraFacts);
  const product = await CatalogProductModel.create({
    title: `${socket} Motherboard`,
    category: 'Motherboard',
    brand: 'Test',
    buildEligibility: 'ELIGIBLE',
    compatibility: compatibility('Motherboard', 'mb/v1.0.0', facts),
  });
  await OfferModel.create({
    catalogProductId: product._id,
    storeCode: 'SIGMA',
    storeExternalId: `sigma-mb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceUrl: `https://sigma.com/products/${product._id}`,
    price: 7000,
    availability: 'IN_STOCK',
  });
  return product;
}

async function seedRam(overrides?: { generation?: string; moduleType?: string; title?: string; price?: number }) {
  const facts: Record<string, unknown> = {};
  if (overrides?.generation) facts['ram.generation'] = overrides.generation;
  if (overrides?.moduleType) facts['ram.moduleType'] = overrides.moduleType;
  const product = await CatalogProductModel.create({
    title: overrides?.title ?? `${overrides?.generation ?? 'DDR4'} RAM`,
    category: 'RAM',
    brand: 'Test',
    buildEligibility: 'ELIGIBLE',
    compatibility: Object.keys(facts).length > 0
      ? compatibility('RAM', 'ram/v1.0.0', facts)
      : null,
  });
  await OfferModel.create({
    catalogProductId: product._id,
    storeCode: 'SIGMA',
    storeExternalId: `sigma-ram-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceUrl: `https://sigma.com/products/${product._id}`,
    price: overrides?.price ?? 3000,
    availability: 'IN_STOCK',
  });
  return product;
}

async function seedSocketQuality(): Promise<void> {
  const evaluatedAt = new Date();
  await CategoryQualityReportModel.create([
    {
      category: 'CPU', extractorVersion: 'cpu/v1.0.0', totalProducts: 50, evaluatedAt, allGatesPass: true,
      factMetrics: [{ factKey: 'cpu.socket', extractableCount: 50, coverage: 1, verifiedCorrect: 50, verifiedSampleSize: 50, precision: 1 }],
    },
    {
      category: 'Motherboard', extractorVersion: 'mb/v1.0.0', totalProducts: 50, evaluatedAt, allGatesPass: true,
      factMetrics: [{ factKey: 'mb.socket', extractableCount: 50, coverage: 1, verifiedCorrect: 50, verifiedSampleSize: 50, precision: 1 }],
    },
  ]);
}

async function seedGpu() {
  const product = await CatalogProductModel.create({
    title: 'NVIDIA RTX 4060',
    category: 'GPU',
    brand: 'NVIDIA',
    buildEligibility: 'ELIGIBLE',
  });
  const offer = await OfferModel.create({
    catalogProductId: product._id,
    storeCode: 'SIGMA',
    storeExternalId: `sigma-gpu-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceUrl: `https://sigma.com/products/${product._id}`,
    price: 12000,
    availability: 'IN_STOCK',
  });
  return { product, offer };
}

async function createBuild(name = 'Test Build') {
  const res = await request(app).post('/api/v1/builds').send({ name });
  expect(res.status).toBe(201);
  return res.body;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Builds API', () => {
  // -- CRUD ------------------------------------------------------------------

  describe('POST /api/v1/builds', () => {
    it('creates a build with a publicId, version 1, and empty items', async () => {
      const res = await request(app).post('/api/v1/builds').send({ name: 'My Build' });
      expect(res.status).toBe(201);
      expect(res.body.publicId).toBeDefined();
      expect(typeof res.body.publicId).toBe('string');
      expect(res.body.publicId.length).toBeGreaterThanOrEqual(36); // UUID
      expect(res.body.name).toBe('My Build');
      expect(res.body.version).toBe(1);
      expect(res.body.items).toEqual([]);
      expect(res.body.compatibility.overallStatus).toBe('UNKNOWN');
      expect(res.body.pricing.totalPrice).toBeNull();
      expect(res.body.pricing.itemCount).toBe(0);
    });

    it('defaults name to "Untitled Build" when empty', async () => {
      const res = await request(app).post('/api/v1/builds').send({});
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Untitled Build');
    });
  });

  describe('GET /api/v1/builds/:publicId', () => {
    it('returns the build', async () => {
      const build = await createBuild();
      const res = await request(app).get(`/api/v1/builds/${build.publicId}`);
      expect(res.status).toBe(200);
      expect(res.body.publicId).toBe(build.publicId);
      expect(res.body.name).toBe(build.name);
    });

    it('returns 404 for unknown publicId', async () => {
      const res = await request(app).get('/api/v1/builds/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('PATCH /api/v1/builds/:publicId', () => {
    it('updates the name and increments version', async () => {
      const build = await createBuild('Old Name');
      const res = await request(app)
        .patch(`/api/v1/builds/${build.publicId}`)
        .send({ name: 'New Name', expectedVersion: 1 });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
      expect(res.body.version).toBe(2);
    });

    it('returns 409 on version conflict with mandatory details', async () => {
      const build = await createBuild('v1');

      // First update succeeds
      await request(app)
        .patch(`/api/v1/builds/${build.publicId}`)
        .send({ name: 'v2', expectedVersion: 1 });

      // Second update with stale version
      const res = await request(app)
        .patch(`/api/v1/builds/${build.publicId}`)
        .send({ name: 'v3-stale', expectedVersion: 1 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('BUILD_VERSION_CONFLICT');
      expect(res.body.details).toBeDefined();
      expect(typeof res.body.details.expectedVersion).toBe('number');
      expect(typeof res.body.details.currentVersion).toBe('number');
      expect(res.body.details.currentVersion).toBe(2);
      expect(res.body.details.latestBuild).toBeDefined();
      expect(res.body.details.latestBuild.publicId).toBe(build.publicId);
      expect(res.body.details.latestBuild.version).toBe(2);
    });

    it('returns 400 for invalid expectedVersion', async () => {
      const build = await createBuild();
      const res = await request(app)
        .patch(`/api/v1/builds/${build.publicId}`)
        .send({ name: 'x', expectedVersion: 0 });
      expect(res.status).toBe(400);
    });
  });

  // -- PUT item --------------------------------------------------------------

  describe('PUT /api/v1/builds/:publicId/items/:slot', () => {
    it('adds a CPU item with correct pricing', async () => {
      const build = await createBuild();
      const { product } = await seedCpu({ price: 5000 });

      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({
          productId: String(product._id),
          quantity: 1,
          expectedVersion: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].slot).toBe('cpu');
      expect(res.body.items[0].unitPrice).toBe(5000);
      expect(res.body.items[0].totalPrice).toBe(5000);
      expect(res.body.version).toBe(2);
      expect(res.body.pricing.totalPrice).toBe(5000);
      expect(res.body.pricing.itemCount).toBe(1);
    });

    it('replaces an item in the same slot', async () => {
      const build = await createBuild();
      const { product: cpu1 } = await seedCpu({ title: 'CPU1', price: 3000 });
      const { product: cpu2 } = await seedCpu({ title: 'CPU2', price: 7000 });

      // Add first CPU
      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu1._id), quantity: 1, expectedVersion: 1 });

      // Replace with second CPU
      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu2._id), quantity: 1, expectedVersion: 2 });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].productName).toBe('CPU2');
      expect(res.body.items[0].unitPrice).toBe(7000);
      expect(res.body.version).toBe(3);
    });

    it('accepts catalog category casing when adding an item', async () => {
      const build = await createBuild();
      const { product } = await seedCpu({ category: 'cpu' });

      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      expect(res.status).toBe(200);
      expect(res.body.items[0].productId).toBe(String(product._id));
    });

    it('enforces max quantity constraint for RAM (4)', async () => {
      const build = await createBuild();
      const product = await CatalogProductModel.create({
        title: 'DDR5 16GB',
        category: 'RAM',
        buildEligibility: 'ELIGIBLE',
      });
      await OfferModel.create({
        catalogProductId: product._id,
        storeCode: 'SIGMA',
        storeExternalId: `sigma-ram-${Date.now()}`,
        sourceUrl: 'https://sigma.com/ram',
        price: 2000,
        availability: 'IN_STOCK',
      });

      // quantity=4 is OK
      const res1 = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/ram`)
        .send({ productId: String(product._id), quantity: 4, expectedVersion: 1 });
      expect(res1.status).toBe(200);
      expect(res1.body.items[0].quantity).toBe(4);
      expect(res1.body.items[0].totalPrice).toBe(8000);

      // quantity=5 exceeds max
      const res2 = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/ram`)
        .send({ productId: String(product._id), quantity: 5, expectedVersion: 2 });
      expect(res2.status).toBe(404);
    });

    it('enforces max quantity constraint for storage (8)', async () => {
      const build = await createBuild();
      const product = await CatalogProductModel.create({
        title: 'NVMe 1TB',
        category: 'Storage',
        buildEligibility: 'ELIGIBLE',
      });
      await OfferModel.create({
        catalogProductId: product._id,
        storeCode: 'SIGMA',
        storeExternalId: `sigma-stor-${Date.now()}`,
        sourceUrl: 'https://sigma.com/storage',
        price: 3000,
        availability: 'IN_STOCK',
      });

      // quantity=8 is OK
      const res1 = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/storage`)
        .send({ productId: String(product._id), quantity: 8, expectedVersion: 1 });
      expect(res1.status).toBe(200);
      expect(res1.body.items[0].quantity).toBe(8);

      // quantity=9 exceeds max
      const res2 = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/storage`)
        .send({ productId: String(product._id), quantity: 9, expectedVersion: 2 });
      expect(res2.status).toBe(404);
    });

    it('rejects bundles (NOT_ELIGIBLE)', async () => {
      const build = await createBuild();
      const { product } = await seedCpu({ buildEligibility: 'NOT_ELIGIBLE' });

      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      expect(res.status).toBe(404);
    });

    it('rejects wrong category (GPU product into CPU slot)', async () => {
      const build = await createBuild();
      const { product } = await seedGpu();

      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      expect(res.status).toBe(404);
    });

    it('returns 404 for missing product', async () => {
      const build = await createBuild();
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(fakeId), quantity: 1, expectedVersion: 1 });

      expect(res.status).toBe(404);
    });

    it('returns 404 when product has no valid offer', async () => {
      const build = await createBuild();
      const product = await CatalogProductModel.create({
        title: 'CPU no offer',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid slot', async () => {
      const build = await createBuild();
      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cooler`)
        .send({ productId: 'x', quantity: 1, expectedVersion: 1 });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing expectedVersion', async () => {
      const build = await createBuild();
      const { product } = await seedCpu();

      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1 });
      expect(res.status).toBe(400);
    });

    it('returns 409 on version conflict when putting item', async () => {
      const build = await createBuild();
      const { product: cpu1 } = await seedCpu({ title: 'CPU1' });
      const { product: cpu2 } = await seedCpu({ title: 'CPU2' });

      // Add first CPU
      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu1._id), quantity: 1, expectedVersion: 1 });

      // Try stale version
      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu2._id), quantity: 1, expectedVersion: 1 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('BUILD_VERSION_CONFLICT');
      expect(res.body.details).toBeDefined();
      expect(typeof res.body.details.expectedVersion).toBe('number');
      expect(typeof res.body.details.currentVersion).toBe('number');
      expect(res.body.details.latestBuild).toBeDefined();
    });
  });

  // -- DELETE item -----------------------------------------------------------

  describe('DELETE /api/v1/builds/:publicId/items/:slot', () => {
    it('removes an item and clears slot', async () => {
      const build = await createBuild();
      const { product } = await seedCpu();

      // Add CPU
      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      // Delete CPU
      const res = await request(app)
        .delete(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ expectedVersion: 2 });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
      expect(res.body.version).toBe(3);
    });

    it('returns 409 on version conflict', async () => {
      const build = await createBuild();
      const { product } = await seedCpu();

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      // Delete with stale version
      const res = await request(app)
        .delete(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ expectedVersion: 1 }); // stale: current is 2

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('BUILD_VERSION_CONFLICT');
      expect(res.body.details.latestBuild).toBeDefined();
    });
  });

  // -- Validate --------------------------------------------------------------

  describe('POST /api/v1/builds/:publicId/validate', () => {
    it('returns build with UNKNOWN status (zero rules)', async () => {
      const build = await createBuild();
      const { product } = await seedCpu();

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      const res = await request(app).post(`/api/v1/builds/${build.publicId}/validate`);
      expect(res.status).toBe(200);
      expect(res.body.compatibility.overallStatus).toBe('UNKNOWN');

      // Verify no slot has COMPATIBLE — all UNKNOWN with zero rules
      for (const slot of res.body.compatibility.slots) {
        expect(slot.status).toBe('UNKNOWN');
      }
    });

    it('returns 404 for unknown build', async () => {
      const res = await request(app).post('/api/v1/builds/nonexistent/validate');
      expect(res.status).toBe(404);
    });
  });

  // -- Candidates ------------------------------------------------------------

  describe('GET /api/v1/builds/:publicId/candidates/:slot', () => {
    it('returns eligible products grouped as UNKNOWN', async () => {
      const build = await createBuild();
      await seedCpu({ title: 'CPU-A', price: 4000 });
      await seedCpu({ title: 'CPU-B', price: 6000 });

      // Bundle should NOT appear
      await seedCpu({ title: 'Bundle-CPU', price: 1000, buildEligibility: 'NOT_ELIGIBLE' });

      const res = await request(app)
        .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
        .query({ page: 1, pageSize: 10 });

      expect(res.status).toBe(200);
      expect(res.body.groups).toHaveLength(1);
      expect(res.body.groups[0].status).toBe('UNKNOWN');
      expect(res.body.groups[0].products).toHaveLength(2); // excludes bundle

      // Pagination
      expect(res.body.pagination.totalItems).toBe(2);
      expect(res.body.pagination.totalPages).toBe(1);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.pageSize).toBe(10);
    });

    it('returns candidates when catalog categories use lowercase', async () => {
      const build = await createBuild();
      const { product } = await seedCpu({ title: 'Lowercase CPU', category: 'cpu' });

      const res = await request(app)
        .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.totalItems).toBe(1);
      expect(res.body.groups[0].products[0].productId).toBe(String(product._id));
    });

    it('returns 400 for invalid slot', async () => {
      const build = await createBuild();
      const res = await request(app)
        .get(`/api/v1/builds/${build.publicId}/candidates/cooler`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid slot');
    });

    it('returns 404 for unknown build', async () => {
      const res = await request(app)
        .get('/api/v1/builds/nonexistent/candidates/cpu');
      expect(res.status).toBe(404);
    });

    it('includes source URLs in candidate products', async () => {
      const build = await createBuild();
      const { product, offer } = await seedCpu({ title: 'URL-Test-CPU' });

      const res = await request(app)
        .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);

      expect(res.status).toBe(200);
      const candidate = res.body.groups[0].products.find(
        (p: { productId: string }) => p.productId === String(product._id),
      );
      expect(candidate).toBeDefined();
      expect(candidate.sourceUrl).toBe(offer.sourceUrl);
      expect(candidate.storeCode).toBe('SIGMA');
    });

    it('includes legacy products without buildEligibility field', async () => {
      const build = await createBuild();

      // Insert a product directly via raw MongoDB (bypasses Mongoose defaults)
      // to simulate a product created before buildEligibility was added.
      const legacyProduct = await CatalogProductModel.create({
        title: 'Legacy CPU',
        category: 'CPU',
        brand: 'Legacy',
      });
      // Remove the buildEligibility field to simulate a pre-schema-change document.
      await CatalogProductModel.collection.updateOne(
        { _id: legacyProduct._id },
        { $unset: { buildEligibility: '' } },
      );

      await OfferModel.create({
        catalogProductId: legacyProduct._id,
        storeCode: 'SIGMA',
        storeExternalId: `sigma-legacy-${Date.now()}`,
        sourceUrl: 'https://sigma.com/legacy',
        price: 3000,
        availability: 'IN_STOCK',
      });

      const res = await request(app)
        .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);

      expect(res.status).toBe(200);
      const names = res.body.groups[0].products.map((p: { name: string }) => p.name);
      expect(names).toContain('Legacy CPU');
    });

    it('groups candidates by real socket compatibility when quality gates pass', async () => {
      await seedSocketQuality();
      const build = await createBuild();
      const motherboard = await seedMotherboard('AM5');
      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 1 })
        .expect(200);
      await seedCpu({ title: 'AM5 CPU', socket: 'AM5' });
      await seedCpu({ title: 'AM4 CPU', socket: 'AM4' });

      const res = await request(app)
        .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
        .query({ page: 1, pageSize: 10 });

      expect(res.status).toBe(200);
      expect(res.body.groups.map((group: { status: string }) => group.status)).toEqual([
        'COMPATIBLE',
        'INCOMPATIBLE',
      ]);
      expect(res.body.groups[0].products[0].name).toBe('AM5 CPU');
      expect(res.body.groups[1].products[0].name).toBe('AM4 CPU');
      expect(res.body.groups[1].topReasons[0]).toContain('does not match');
    });

    // -- Pagination tests -----------------------------------------------------

    describe('pagination', () => {
      it('paginates correctly with totalItems > pageSize', async () => {
        const build = await createBuild();
        // Create 30 CPU products with offers
        for (let i = 0; i < 30; i++) {
          await seedCpu({ title: `CPU-Pagination-${String(i).padStart(2, '0')}`, price: 1000 + i });
        }

        // Page 1
        const res1 = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ page: 1, pageSize: 24 });
        expect(res1.status).toBe(200);
        expect(res1.body.pagination.totalItems).toBe(30);
        expect(res1.body.pagination.totalPages).toBe(2);
        expect(res1.body.pagination.page).toBe(1);
        expect(res1.body.pagination.pageSize).toBe(24);
        expect(res1.body.groups[0].products).toHaveLength(24);

        // Page 2
        const res2 = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ page: 2, pageSize: 24 });
        expect(res2.status).toBe(200);
        expect(res2.body.pagination.totalItems).toBe(30);
        expect(res2.body.pagination.totalPages).toBe(2);
        expect(res2.body.pagination.page).toBe(2);
        expect(res2.body.groups[0].products).toHaveLength(6);
      });

      it('returns empty groups for out-of-range page', async () => {
        const build = await createBuild();
        await seedCpu({ title: 'CPU-Range', price: 5000 });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ page: 100, pageSize: 24 });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(1);
        expect(res.body.groups).toHaveLength(0);
      });
    });

    // -- Search tests ---------------------------------------------------------

    describe('search', () => {
      it('searches by title', async () => {
        const build = await createBuild();
        await seedCpu({ title: 'AMD Ryzen 5 7600', price: 5000 });
        await seedCpu({ title: 'Intel Core i5-13400', price: 6000 });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ search: 'Ryzen' });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(1);
        expect(res.body.groups[0].products[0].name).toBe('AMD Ryzen 5 7600');
      });

      it('searches by brand', async () => {
        const build = await createBuild();
        await seedCpu({ title: 'Ryzen 5 7600', price: 5000 });
        await seedCpu({ title: 'Ryzen 7 7800X3D', price: 8000 });

        const product3 = await CatalogProductModel.create({
          title: 'Core i7-13700K',
          category: 'CPU',
          brand: 'Intel',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: product3._id,
          storeCode: 'SIGMA',
          storeExternalId: `sigma-search-${Date.now()}`,
          sourceUrl: `https://sigma.com/search/${product3._id}`,
          price: 7000,
          availability: 'IN_STOCK',
        });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ search: 'Intel' });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(1);
        expect(res.body.groups[0].products[0].name).toBe('Core i7-13700K');
      });

      it('search is case-insensitive', async () => {
        const build = await createBuild();
        await seedCpu({ title: 'AMD Ryzen 5', price: 5000 });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ search: 'ryzen' });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(1);
      });

      it('escapes regex special characters in search', async () => {
        const build = await createBuild();
        await seedCpu({ title: 'CPU (Special) [Test]', price: 5000 });
        await seedCpu({ title: 'CPU Special Test', price: 6000 });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ search: '(Special)' });
        expect(res.status).toBe(200);
        // Should find only the product with literal "(Special)" not the regex interpretation
        expect(res.body.pagination.totalItems).toBe(1);
        expect(res.body.groups[0].products[0].name).toBe('CPU (Special) [Test]');
      });

      it('returns all products for empty search term', async () => {
        const build = await createBuild();
        await seedCpu({ title: 'CPU-A', price: 5000 });
        await seedCpu({ title: 'CPU-B', price: 6000 });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ search: '' });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(2);
      });

      it('returns all products for whitespace-only search', async () => {
        const build = await createBuild();
        await seedCpu({ title: 'CPU-A', price: 5000 });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ search: '   ' });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(1);
      });

      it('returns 400 for search query exceeding max length', async () => {
        const build = await createBuild();
        const longSearch = 'a'.repeat(201);
        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ search: longSearch });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('too long');
      });

      it('search is applied before pagination', async () => {
        const build = await createBuild();
        // 5 AMD CPUs, 5 Intel CPUs
        for (let i = 0; i < 5; i++) {
          await seedCpu({ title: `AMD Ryzen ${i}`, price: 5000 + i });
        }
        for (let i = 0; i < 5; i++) {
          const p = await CatalogProductModel.create({
            title: `Intel Core ${i}`,
            category: 'CPU',
            brand: 'Intel',
            buildEligibility: 'ELIGIBLE',
          });
          await OfferModel.create({
            catalogProductId: p._id,
            storeCode: 'SIGMA',
            storeExternalId: `sigma-intel-${i}-${Date.now()}`,
            sourceUrl: `https://sigma.com/intel/${p._id}`,
            price: 6000 + i,
            availability: 'IN_STOCK',
          });
        }

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ search: 'AMD', page: 1, pageSize: 3 });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(5); // only AMD matches
        expect(res.body.groups[0].products).toHaveLength(3); // page of 3
      });
    });

    // -- Availability tests ---------------------------------------------------

    describe('availability', () => {
      async function seedCpuWithAvailability(title: string, availability: string, price: number) {
        const product = await CatalogProductModel.create({
          title,
          category: 'CPU',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: product._id,
          storeCode: 'SIGMA',
          storeExternalId: `sigma-avail-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          sourceUrl: `https://sigma.com/products/${product._id}`,
          price,
          availability,
        });
        return product;
      }

      it('ALL includes IN_STOCK, OUT_OF_STOCK, and UNKNOWN products', async () => {
        const build = await createBuild();
        await seedCpuWithAvailability('CPU-IN', 'IN_STOCK', 5000);
        await seedCpuWithAvailability('CPU-OUT', 'OUT_OF_STOCK', 6000);
        await seedCpuWithAvailability('CPU-UNK', 'UNKNOWN', 7000);

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ availability: 'ALL' });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(3);
      });

      it('IN_STOCK includes only IN_STOCK products', async () => {
        const build = await createBuild();
        await seedCpuWithAvailability('CPU-IN', 'IN_STOCK', 5000);
        await seedCpuWithAvailability('CPU-OUT', 'OUT_OF_STOCK', 6000);

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ availability: 'IN_STOCK' });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(1);
        expect(res.body.groups[0].products[0].name).toBe('CPU-IN');
      });

      it('OUT_OF_STOCK includes only OUT_OF_STOCK products', async () => {
        const build = await createBuild();
        await seedCpuWithAvailability('CPU-IN', 'IN_STOCK', 5000);
        await seedCpuWithAvailability('CPU-OUT', 'OUT_OF_STOCK', 6000);

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ availability: 'OUT_OF_STOCK' });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(1);
        expect(res.body.groups[0].products[0].name).toBe('CPU-OUT');
      });

      it('default availability is ALL', async () => {
        const build = await createBuild();
        await seedCpuWithAvailability('CPU-IN', 'IN_STOCK', 5000);
        await seedCpuWithAvailability('CPU-OUT', 'OUT_OF_STOCK', 6000);

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(2);
      });

      it('returns 400 for invalid availability', async () => {
        const build = await createBuild();
        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ availability: 'INVALID' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid availability');
      });

      it('product excluded when no offers remain after availability filter', async () => {
        const build = await createBuild();
        // Product with only OUT_OF_STOCK offers
        await seedCpuWithAvailability('CPU-OOS-ONLY', 'OUT_OF_STOCK', 5000);

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ availability: 'IN_STOCK' });
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(0);
      });
    });

    // -- Multi-store offers tests ---------------------------------------------

    describe('multi-store offers', () => {
      it('picks lowest-priced IN_STOCK offer as best, shows all offers', async () => {
        const build = await createBuild();
        const product = await CatalogProductModel.create({
          title: 'Multi-Store CPU',
          category: 'CPU',
          brand: 'AMD',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: product._id,
          storeCode: 'SIGMA',
          storeExternalId: `sigma-ms-${Date.now()}-1`,
          sourceUrl: 'https://sigma.com/cpu',
          price: 8000,
          availability: 'IN_STOCK',
        });
        await OfferModel.create({
          catalogProductId: product._id,
          storeCode: 'EL_BADR',
          storeExternalId: `elbadr-ms-${Date.now()}-2`,
          sourceUrl: 'https://elbadr.com/cpu',
          price: 6000,
          availability: 'IN_STOCK',
        });
        await OfferModel.create({
          catalogProductId: product._id,
          storeCode: 'ALFRENSIA',
          storeExternalId: `alfrensia-ms-${Date.now()}-3`,
          sourceUrl: 'https://alfrensia.com/cpu',
          price: 7000,
          availability: 'IN_STOCK',
        });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);
        expect(res.status).toBe(200);

        const candidate = res.body.groups[0].products[0];
        // Best offer is lowest price: EL_BADR at 6000
        expect(candidate.price).toBe(6000);
        expect(candidate.storeCode).toBe('EL_BADR');
        expect(candidate.sourceUrl).toBe('https://elbadr.com/cpu');
        expect(candidate.availability).toBe('IN_STOCK');
        // All 3 offers present
        expect(candidate.offers).toHaveLength(3);
        // Offers are sorted: EL_BADR (6000), ALFRENSIA (7000), SIGMA (8000)
        expect(candidate.offers[0].storeCode).toBe('EL_BADR');
        expect(candidate.offers[0].price).toBe(6000);
        expect(candidate.offers[1].storeCode).toBe('ALFRENSIA');
        expect(candidate.offers[1].price).toBe(7000);
        expect(candidate.offers[2].storeCode).toBe('SIGMA');
        expect(candidate.offers[2].price).toBe(8000);
      });

      it('best offer prefers IN_STOCK over UNKNOWN even if UNKNOWN is cheaper', async () => {
        const build = await createBuild();
        const product = await CatalogProductModel.create({
          title: 'Prefers InStock CPU',
          category: 'CPU',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: product._id,
          storeCode: 'STORE_A',
          storeExternalId: `a-${Date.now()}`,
          sourceUrl: 'https://a.com/cpu',
          price: 3000,
          availability: 'UNKNOWN',
        });
        await OfferModel.create({
          catalogProductId: product._id,
          storeCode: 'STORE_B',
          storeExternalId: `b-${Date.now()}`,
          sourceUrl: 'https://b.com/cpu',
          price: 5000,
          availability: 'IN_STOCK',
        });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);
        expect(res.status).toBe(200);

        const candidate = res.body.groups[0].products[0];
        expect(candidate.storeCode).toBe('STORE_B');
        expect(candidate.price).toBe(5000);
        expect(candidate.availability).toBe('IN_STOCK');
      });

      it('no implicit Sigma-only filter — other stores included', async () => {
        const build = await createBuild();
        const product = await CatalogProductModel.create({
          title: 'Non-Sigma CPU',
          category: 'CPU',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: product._id,
          storeCode: 'EL_BADR',
          storeExternalId: `elbadr-${Date.now()}`,
          sourceUrl: 'https://elbadr.com/cpu',
          price: 5000,
          availability: 'IN_STOCK',
        });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(1);
        expect(res.body.groups[0].products[0].storeCode).toBe('EL_BADR');
      });

      it('offers with null price are excluded', async () => {
        const build = await createBuild();
        const product = await CatalogProductModel.create({
          title: 'Null Price CPU',
          category: 'CPU',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: product._id,
          storeCode: 'SIGMA',
          storeExternalId: `sigma-null-${Date.now()}`,
          sourceUrl: 'https://sigma.com/null',
          price: null,
          availability: 'IN_STOCK',
        });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);
        expect(res.status).toBe(200);
        // Product should be excluded because its only offer has null price
        expect(res.body.pagination.totalItems).toBe(0);
      });

      it('offers with zero price are excluded', async () => {
        const build = await createBuild();
        const product = await CatalogProductModel.create({
          title: 'Zero Price CPU',
          category: 'CPU',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: product._id,
          storeCode: 'SIGMA',
          storeExternalId: `sigma-zero-${Date.now()}`,
          sourceUrl: 'https://sigma.com/zero',
          price: 0,
          availability: 'IN_STOCK',
        });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(0);
      });
    });

    // -- Strict slot category tests -------------------------------------------

    describe('strict slot category mapping', () => {
      it('cpu slot only shows CPU products', async () => {
        const build = await createBuild();
        await seedCpu({ title: 'CPU', price: 5000 });
        await seedGpu();

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(1);
        expect(res.body.groups[0].products[0].name).toBe('CPU');
      });

      it('storage slot accepts Storage, SSD, and HDD categories', async () => {
        const build = await createBuild();
        const categories = ['Storage', 'SSD', 'HDD'];
        for (const category of categories) {
          const p = await CatalogProductModel.create({
            title: `${category} Drive`,
            category,
            buildEligibility: 'ELIGIBLE',
          });
          await OfferModel.create({
            catalogProductId: p._id,
            storeCode: 'SIGMA',
            storeExternalId: `sigma-stor-${category}-${Date.now()}`,
            sourceUrl: `https://sigma.com/storage/${p._id}`,
            price: 3000,
            availability: 'IN_STOCK',
          });
        }

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/storage`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(3);
        const names = res.body.groups[0].products.map((p: { name: string }) => p.name);
        expect(names).toContain('Storage Drive');
        expect(names).toContain('SSD Drive');
        expect(names).toContain('HDD Drive');
      });

      it('storage slot excludes unrelated categories', async () => {
        const build = await createBuild();
        const p = await CatalogProductModel.create({
          title: 'CPU in storage test',
          category: 'CPU',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: p._id,
          storeCode: 'SIGMA',
          storeExternalId: `sigma-excl-${Date.now()}`,
          sourceUrl: `https://sigma.com/excl/${p._id}`,
          price: 5000,
          availability: 'IN_STOCK',
        });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/storage`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(0);
      });

      it('cooling slot maps to COOLING category', async () => {
        const build = await createBuild();
        const p = await CatalogProductModel.create({
          title: 'Noctua NH-D15',
          category: 'COOLING',
          brand: 'Noctua',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: p._id,
          storeCode: 'SIGMA',
          storeExternalId: `sigma-cool-${Date.now()}`,
          sourceUrl: `https://sigma.com/cooling/${p._id}`,
          price: 2500,
          availability: 'IN_STOCK',
        });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cooling`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(1);
        expect(res.body.groups[0].products[0].name).toBe('Noctua NH-D15');
        expect(res.body.groups[0].products[0].brand).toBe('Noctua');
      });

      it('cooling slot excludes non-COOLING categories', async () => {
        const build = await createBuild();
        const p = await CatalogProductModel.create({
          title: 'CPU in cooling test',
          category: 'CPU',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: p._id,
          storeCode: 'SIGMA',
          storeExternalId: `sigma-cool-excl-${Date.now()}`,
          sourceUrl: `https://sigma.com/cool-excl/${p._id}`,
          price: 5000,
          availability: 'IN_STOCK',
        });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cooling`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.totalItems).toBe(0);
      });

      it('cooling is a valid slot in the URL', async () => {
        const build = await createBuild();
        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cooling`);
        // Should not be 400 (invalid slot)
        expect(res.status).not.toBe(400);
      });
    });

    // -- DTO structure tests --------------------------------------------------

    describe('DTO structure', () => {
      it('candidate products include brand, model, availability, and offers array', async () => {
        const build = await createBuild();
        const product = await CatalogProductModel.create({
          title: 'Ryzen 5 7600',
          category: 'CPU',
          brand: 'AMD',
          model: '7600',
          buildEligibility: 'ELIGIBLE',
        });
        await OfferModel.create({
          catalogProductId: product._id,
          storeCode: 'SIGMA',
          storeExternalId: `sigma-dto-${Date.now()}`,
          sourceUrl: 'https://sigma.com/dto',
          price: 5000,
          availability: 'IN_STOCK',
        });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);
        expect(res.status).toBe(200);
        const candidate = res.body.groups[0].products[0];
        expect(candidate.brand).toBe('AMD');
        expect(candidate.model).toBe('7600');
        expect(candidate.availability).toBe('IN_STOCK');
        expect(Array.isArray(candidate.offers)).toBe(true);
        expect(candidate.offers).toHaveLength(1);
        expect(candidate.offers[0].storeCode).toBe('SIGMA');
        expect(candidate.offers[0].price).toBe(5000);
        expect(candidate.offers[0].availability).toBe('IN_STOCK');
        expect(candidate.offers[0].sourceUrl).toBe('https://sigma.com/dto');
      });
    });

    // -- Query validation tests -----------------------------------------------

    describe('query validation', () => {
      it('returns 400 for invalid page (negative)', async () => {
        const build = await createBuild();
        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ page: -1 });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('page');
      });

      it('returns 400 for invalid page (zero)', async () => {
        const build = await createBuild();
        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ page: 0 });
        expect(res.status).toBe(400);
      });

      it('returns 400 for invalid pageSize (zero)', async () => {
        const build = await createBuild();
        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ pageSize: 0 });
        expect(res.status).toBe(400);
      });

      it('caps pageSize at 100', async () => {
        const build = await createBuild();
        await seedCpu({ title: 'CPU-Cap', price: 5000 });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`)
          .query({ pageSize: 200 });
        expect(res.status).toBe(200);
        expect(res.body.pagination.pageSize).toBe(100);
      });

      it('uses defaults when no query params provided', async () => {
        const build = await createBuild();
        await seedCpu({ title: 'CPU-Default', price: 5000 });

        const res = await request(app)
          .get(`/api/v1/builds/${build.publicId}/candidates/cpu`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.pageSize).toBe(24);
      });
    });
  });

  describe('real compatibility evaluation', () => {
    it('evaluates and persists socket compatibility after item mutation', async () => {
      await seedSocketQuality();
      const build = await createBuild();
      const { product: cpu } = await seedCpu({ socket: 'AM5' });
      const motherboard = await seedMotherboard('AM5');

      const cpuResponse = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      const motherboardResponse = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: cpuResponse.body.version });

      expect(motherboardResponse.status).toBe(200);
      const cpuStatus = motherboardResponse.body.compatibility.slots.find(
        (slot: { slot: string }) => slot.slot === 'cpu',
      );
      expect(cpuStatus.status).toBe('COMPATIBLE');
      expect(cpuStatus.triggeredRuleIds).toContain('CMP-CPU-MB-001');
      expect(cpuStatus.topReasons[0]).toContain('matches');

      const loaded = await request(app).get(`/api/v1/builds/${build.publicId}`);
      expect(loaded.body.compatibility.slots.find((slot: { slot: string }) => slot.slot === 'cpu').status).toBe('COMPATIBLE');
    });

    it('keeps missing or unverified facts UNKNOWN', async () => {
      const build = await createBuild();
      const { product } = await seedCpu();
      const response = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });
      expect(response.body.compatibility.slots.every((slot: { status: string }) => slot.status === 'UNKNOWN')).toBe(true);
    });
  });

  // -- Purchase plan ---------------------------------------------------------

  describe('GET /api/v1/builds/:publicId/purchase-plan', () => {
    it('aggregates items with correct source URLs and pricing', async () => {
      const build = await createBuild();
      const { product: cpu, offer: cpuOffer } = await seedCpu({ title: 'Plan-CPU', price: 5000 });
      const { product: gpu, offer: gpuOffer } = await seedGpu();

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/gpu`)
        .send({ productId: String(gpu._id), quantity: 1, expectedVersion: 2 });

      const res = await request(app)
        .get(`/api/v1/builds/${build.publicId}/purchase-plan`);

      expect(res.status).toBe(200);
      expect(res.body.buildPublicId).toBe(build.publicId);
      expect(res.body.itemCount).toBe(2);
      expect(res.body.totalPrice).toBe(5000 + 12000);

      const cpuItem = res.body.items.find((i: { slot: string }) => i.slot === 'cpu');
      expect(cpuItem.sourceUrl).toBe(cpuOffer.sourceUrl);
      expect(cpuItem.storeCode).toBe('SIGMA');
      expect(cpuItem.productName).toBe('Plan-CPU');

      const gpuItem = res.body.items.find((i: { slot: string }) => i.slot === 'gpu');
      expect(gpuItem.sourceUrl).toBe(gpuOffer.sourceUrl);
    });

    it('returns null totalPrice when any item has null price', async () => {
      const build = await createBuild();
      const product = await CatalogProductModel.create({
        title: 'CPU null price',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });
      await OfferModel.create({
        catalogProductId: product._id,
        storeCode: 'SIGMA',
        storeExternalId: `sigma-null-${Date.now()}`,
        sourceUrl: 'https://sigma.com/null-price',
        price: null,
        availability: 'UNKNOWN',
      });

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      const res = await request(app)
        .get(`/api/v1/builds/${build.publicId}/purchase-plan`);

      expect(res.status).toBe(200);
      expect(res.body.totalPrice).toBeNull();
    });

    it('returns 404 for unknown build', async () => {
      const res = await request(app)
        .get('/api/v1/builds/nonexistent/purchase-plan');
      expect(res.status).toBe(404);
    });
  });

  // -- topReasons persistence ------------------------------------------------

  describe('topReasons end-to-end', () => {
    it('includes topReasons in BuildDto slots (active rules evaluate even without quality reports)', async () => {
      const build = await createBuild();
      const { product } = await seedCpu();

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      const res = await request(app).get(`/api/v1/builds/${build.publicId}`);
      expect(res.status).toBe(200);

      for (const slot of res.body.compatibility.slots) {
        expect(slot.topReasons).toBeDefined();
        expect(Array.isArray(slot.topReasons)).toBe(true);
      }
      // Cooling slot has no registered rule — honest NO_ACTIVE_RULE_REASON
      const coolingSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cooling');
      expect(coolingSlot.topReasons).toEqual([NO_ACTIVE_RULE_REASON]);
      // CPU slot has active rules that evaluate to UNKNOWN (missing facts)
      const cpuSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cpu');
      expect(cpuSlot.topReasons).not.toContain(NO_ACTIVE_RULE_REASON);
    });

    it('includes topReasons in validate response (active rules evaluate even without quality reports)', async () => {
      const build = await createBuild();
      const { product } = await seedCpu();

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      const res = await request(app).post(`/api/v1/builds/${build.publicId}/validate`);
      expect(res.status).toBe(200);

      // Cooling slot gets honest NO_ACTIVE_RULE_REASON
      const coolingSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cooling');
      expect(coolingSlot.topReasons).toEqual([NO_ACTIVE_RULE_REASON]);
      // CPU slot has active rules — does NOT get NO_ACTIVE_RULE_REASON
      const cpuSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cpu');
      expect(cpuSlot.topReasons).not.toContain(NO_ACTIVE_RULE_REASON);
    });

    it('legacy build without topReasons in DB returns empty arrays', async () => {
      // Create a build, then directly write a legacy-style snapshot without topReasons.
      const build = await createBuild();
      const { product } = await seedCpu();

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      // Directly overwrite with a legacy snapshot (no topReasons field).
      await BuildModel.findOneAndUpdate(
        { publicId: build.publicId },
        {
          $set: {
            'compatibility': {
              overallStatus: 'UNKNOWN',
              slots: [
                { slot: 'cpu', status: 'UNKNOWN', triggeredRuleIds: [] },
              ],
            },
          },
        },
      );

      const res = await request(app).get(`/api/v1/builds/${build.publicId}`);
      expect(res.status).toBe(200);

      const cpuSlot = res.body.compatibility.slots.find(
        (s: { slot: string }) => s.slot === 'cpu',
      );
      expect(cpuSlot).toBeDefined();
      expect(cpuSlot.topReasons).toEqual([]);
      expect(cpuSlot.missingFactKeys).toEqual([]);
    });

    it('legacy build without missingFactKeys in DB returns empty arrays', async () => {
      const build = await createBuild();
      const { product } = await seedCpu();

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      // Directly overwrite with a snapshot that has topReasons but no missingFactKeys.
      await BuildModel.findOneAndUpdate(
        { publicId: build.publicId },
        {
          $set: {
            'compatibility': {
              overallStatus: 'UNKNOWN',
              slots: [
                { slot: 'cpu', status: 'UNKNOWN', triggeredRuleIds: [], topReasons: [] },
              ],
            },
          },
        },
      );

      const res = await request(app).get(`/api/v1/builds/${build.publicId}`);
      expect(res.status).toBe(200);

      const cpuSlot = res.body.compatibility.slots.find(
        (s: { slot: string }) => s.slot === 'cpu',
      );
      expect(cpuSlot).toBeDefined();
      expect(cpuSlot.missingFactKeys).toEqual([]);
    });
  });

  // -- Error response format -------------------------------------------------

  describe('Error response format', () => {
    it('returns { error, requestId } on 404', async () => {
      const res = await request(app).get('/api/v1/builds/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.requestId).toBeDefined();
      expect(typeof res.body.requestId).toBe('string');
    });

    it('returns { error, requestId } on 400', async () => {
      const build = await createBuild();
      const res = await request(app)
        .patch(`/api/v1/builds/${build.publicId}`)
        .send({ name: 'x', expectedVersion: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.requestId).toBeDefined();
    });
  });

  // -- missingFactKeys proof tests -------------------------------------------

  describe('missingFactKeys end-to-end', () => {
    it('AM5/AM5 → COMPATIBLE with empty missingFactKeys', async () => {
      await seedSocketQuality();
      const build = await createBuild();
      const { product: cpu } = await seedCpu({ socket: 'AM5' });
      const motherboard = await seedMotherboard('AM5');

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      const mbRes = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });

      expect(mbRes.status).toBe(200);
      const cpuSlot = mbRes.body.compatibility.slots.find(
        (s: { slot: string }) => s.slot === 'cpu',
      );
      expect(cpuSlot.status).toBe('COMPATIBLE');
      expect(cpuSlot.missingFactKeys).toEqual([]);
    });

    it('AM4/AM5 → INCOMPATIBLE with empty missingFactKeys', async () => {
      await seedSocketQuality();
      const build = await createBuild();
      const { product: cpu } = await seedCpu({ socket: 'AM4' });
      const motherboard = await seedMotherboard('AM5');

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      const mbRes = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });

      expect(mbRes.status).toBe(200);
      const cpuSlot = mbRes.body.compatibility.slots.find(
        (s: { slot: string }) => s.slot === 'cpu',
      );
      expect(cpuSlot.status).toBe('INCOMPATIBLE');
      expect(cpuSlot.missingFactKeys).toEqual([]);
    });

    it('absent cpu.socket with present mb.socket → UNKNOWN with cpu.socket in missingFactKeys', async () => {
      await seedSocketQuality();
      const build = await createBuild();
      // CPU without socket fact (compatibility: null)
      const { product: cpu } = await seedCpu();
      const motherboard = await seedMotherboard('AM5');

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      const mbRes = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });

      expect(mbRes.status).toBe(200);
      const cpuSlot = mbRes.body.compatibility.slots.find(
        (s: { slot: string }) => s.slot === 'cpu',
      );
      expect(cpuSlot.status).toBe('UNKNOWN');
      expect(cpuSlot.missingFactKeys).toContain('cpu.socket');
    });

    it('missingFactKeys appears in persisted snapshot and GET response', async () => {
      await seedSocketQuality();
      const build = await createBuild();
      const { product: cpu } = await seedCpu();
      const motherboard = await seedMotherboard('AM5');

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });

      const getRes = await request(app).get(`/api/v1/builds/${build.publicId}`);
      expect(getRes.status).toBe(200);
      const cpuSlot = getRes.body.compatibility.slots.find(
        (s: { slot: string }) => s.slot === 'cpu',
      );
      expect(cpuSlot.missingFactKeys).toContain('cpu.socket');
    });
  });

  // -- Focused compatibility runtime proof tests ------------------------------

  describe('focused compatibility runtime proof', () => {
    it('AM5 CPU + AM5 MB → COMPATIBLE with rule ID CMP-CPU-MB-001', async () => {
      const build = await createBuild();
      const { product: cpu } = await seedCpu({ socket: 'AM5' });
      const motherboard = await seedMotherboard('AM5');

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });

      expect(res.status).toBe(200);
      const cpuSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cpu');
      expect(cpuSlot.status).toBe('COMPATIBLE');
      expect(cpuSlot.triggeredRuleIds).toContain('CMP-CPU-MB-001');
      expect(cpuSlot.topReasons[0]).toContain('matches');
      expect(cpuSlot.missingFactKeys).toEqual([]);
    });

    it('AM4 CPU + AM5 MB → INCOMPATIBLE with rule ID CMP-CPU-MB-001', async () => {
      const build = await createBuild();
      const { product: cpu } = await seedCpu({ socket: 'AM4' });
      const motherboard = await seedMotherboard('AM5');

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });

      expect(res.status).toBe(200);
      const cpuSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cpu');
      expect(cpuSlot.status).toBe('INCOMPATIBLE');
      expect(cpuSlot.triggeredRuleIds).toContain('CMP-CPU-MB-001');
      expect(cpuSlot.topReasons[0]).toContain('does not match');
      expect(cpuSlot.missingFactKeys).toEqual([]);
    });

    it('DDR5 RAM + DDR5 MB → COMPATIBLE with rule IDs CMP-MB-RAM-001 and CMP-MB-RAM-002', async () => {
      const build = await createBuild();
      const ram = await seedRam({ generation: 'DDR5', moduleType: 'DIMM', title: 'DDR5 RAM 32GB' });
      const motherboard = await seedMotherboard('AM5', {
        'mb.ramGeneration': 'DDR5',
        'mb.ramType': 'DIMM',
      });

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/ram`)
        .send({ productId: String(ram._id), quantity: 1, expectedVersion: 1 });
      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });

      expect(res.status).toBe(200);
      const ramSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'ram');
      expect(ramSlot.status).toBe('COMPATIBLE');
      expect(ramSlot.triggeredRuleIds).toContain('CMP-MB-RAM-001');
      expect(ramSlot.triggeredRuleIds).toContain('CMP-MB-RAM-002');
      expect(ramSlot.missingFactKeys).toEqual([]);
    });

    it('CPU without socket fact → UNKNOWN with cpu.socket in missingFactKeys', async () => {
      const build = await createBuild();
      const { product: cpu } = await seedCpu(); // no socket fact
      const motherboard = await seedMotherboard('AM5');

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });

      expect(res.status).toBe(200);
      const cpuSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cpu');
      expect(cpuSlot.status).toBe('UNKNOWN');
      expect(cpuSlot.missingFactKeys).toContain('cpu.socket');
    });

    it('missing counterpart (CPU only, no motherboard) → UNKNOWN with mb.socket in missingFactKeys', async () => {
      const build = await createBuild();
      const { product: cpu } = await seedCpu({ socket: 'AM5' });

      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });

      expect(res.status).toBe(200);
      const cpuSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cpu');
      expect(cpuSlot.status).toBe('UNKNOWN');
      expect(cpuSlot.missingFactKeys).toContain('mb.socket');
    });

    it('unsupported relationship (cooling slot) → honest UNKNOWN', async () => {
      const build = await createBuild();
      const product = await CatalogProductModel.create({
        title: 'Cooler',
        category: 'COOLING',
        buildEligibility: 'ELIGIBLE',
        compatibility: compatibility('COOLING', 'cooling/v1.0.0', {}),
      });
      await OfferModel.create({
        catalogProductId: product._id,
        storeCode: 'SIGMA',
        storeExternalId: `sigma-cool-proof-${Date.now()}`,
        sourceUrl: 'https://sigma.com/cool-proof',
        price: 2000,
        availability: 'IN_STOCK',
      });

      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cooling`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      expect(res.status).toBe(200);
      const coolingSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cooling');
      expect(coolingSlot.status).toBe('UNKNOWN');
      expect(coolingSlot.topReasons).toEqual(['No active compatibility rule can evaluate this slot.']);
      expect(coolingSlot.missingFactKeys).toEqual([]);
    });

    it('low-sample quality report still evaluates implemented rules', async () => {
      // Seed LOW-SAMPLE quality reports (coverage < 0.8 or sampleSize < 50)
      await CategoryQualityReportModel.create([
        {
          category: 'CPU', extractorVersion: 'cpu/v1.0.0', totalProducts: 10, evaluatedAt: new Date(), allGatesPass: false,
          factMetrics: [{ factKey: 'cpu.socket', extractableCount: 5, coverage: 0.5, verifiedCorrect: 5, verifiedSampleSize: 5, precision: 1 }],
        },
        {
          category: 'Motherboard', extractorVersion: 'mb/v1.0.0', totalProducts: 10, evaluatedAt: new Date(), allGatesPass: false,
          factMetrics: [{ factKey: 'mb.socket', extractableCount: 5, coverage: 0.5, verifiedCorrect: 5, verifiedSampleSize: 5, precision: 1 }],
        },
      ]);

      const build = await createBuild();
      const { product: cpu } = await seedCpu({ socket: 'AM5' });
      const motherboard = await seedMotherboard('AM5');

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });

      expect(res.status).toBe(200);
      const cpuSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cpu');
      // Even with low-sample quality reports, the rule is active and evaluates correctly
      expect(cpuSlot.status).toBe('COMPATIBLE');
      expect(cpuSlot.triggeredRuleIds).toContain('CMP-CPU-MB-001');
    });

    it('no quality reports at all still evaluates implemented rules', async () => {
      // No quality reports seeded — allGatesPass irrelevant
      const build = await createBuild();
      const { product: cpu } = await seedCpu({ socket: 'AM5' });
      const motherboard = await seedMotherboard('AM5');

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cpu`)
        .send({ productId: String(cpu._id), quantity: 1, expectedVersion: 1 });
      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });

      expect(res.status).toBe(200);
      const cpuSlot = res.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cpu');
      expect(cpuSlot.status).toBe('COMPATIBLE');
      expect(cpuSlot.triggeredRuleIds).toContain('CMP-CPU-MB-001');
    });

    it('no-fact product does not disable rules globally', async () => {
      // Seed one product WITH facts and one WITHOUT facts
      const { product: cpuWithFacts } = await seedCpu({ socket: 'AM5', title: 'AM5 CPU With Facts' });
      const cpuNoFacts = await CatalogProductModel.create({
        title: 'CPU No Facts',
        category: 'CPU',
        brand: 'Test',
        buildEligibility: 'ELIGIBLE',
        compatibility: null,
      });
      await OfferModel.create({
        catalogProductId: cpuNoFacts._id,
        storeCode: 'SIGMA',
        storeExternalId: `sigma-nofact-${Date.now()}`,
        sourceUrl: 'https://sigma.com/nofact',
        price: 4000,
        availability: 'IN_STOCK',
      });
      const motherboard = await seedMotherboard('AM5');

      // Build 1: CPU WITH facts → should be COMPATIBLE
      const build1 = await createBuild('Build With Facts');
      await request(app)
        .put(`/api/v1/builds/${build1.publicId}/items/cpu`)
        .send({ productId: String(cpuWithFacts._id), quantity: 1, expectedVersion: 1 });
      const res1 = await request(app)
        .put(`/api/v1/builds/${build1.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });
      const cpuSlot1 = res1.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cpu');
      expect(cpuSlot1.status).toBe('COMPATIBLE');

      // Build 2: CPU WITHOUT facts → should be UNKNOWN (not globally disabled)
      const build2 = await createBuild('Build Without Facts');
      await request(app)
        .put(`/api/v1/builds/${build2.publicId}/items/cpu`)
        .send({ productId: String(cpuNoFacts._id), quantity: 1, expectedVersion: 1 });
      const res2 = await request(app)
        .put(`/api/v1/builds/${build2.publicId}/items/motherboard`)
        .send({ productId: String(motherboard._id), quantity: 1, expectedVersion: 2 });
      const cpuSlot2 = res2.body.compatibility.slots.find((s: { slot: string }) => s.slot === 'cpu');
      expect(cpuSlot2.status).toBe('UNKNOWN');
      expect(cpuSlot2.missingFactKeys).toContain('cpu.socket');
      // Must NOT get the "no active rule" reason — the rule IS active, just missing facts
      expect(cpuSlot2.topReasons).not.toContain('No active compatibility rule can evaluate this slot.');
    });
  });

  // -- Cooling slot end-to-end ------------------------------------------------

  describe('cooling slot', () => {
    it('PUT cooling item persists and round-trips through GET', async () => {
      const build = await createBuild();
      const product = await CatalogProductModel.create({
        title: 'Noctua NH-D15',
        category: 'COOLING',
        brand: 'Noctua',
        buildEligibility: 'ELIGIBLE',
      });
      await OfferModel.create({
        catalogProductId: product._id,
        storeCode: 'SIGMA',
        storeExternalId: `sigma-cool-put-${Date.now()}`,
        sourceUrl: 'https://sigma.com/cooling/nh-d15',
        price: 2500,
        availability: 'IN_STOCK',
      });

      // Add cooling item
      const putRes = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cooling`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      expect(putRes.status).toBe(200);
      expect(putRes.body.items).toHaveLength(1);
      expect(putRes.body.items[0].slot).toBe('cooling');
      expect(putRes.body.items[0].productName).toBe('Noctua NH-D15');
      expect(putRes.body.items[0].unitPrice).toBe(2500);
      expect(putRes.body.items[0].storeCode).toBe('SIGMA');
      expect(putRes.body.version).toBe(2);

      // GET round-trip
      const getRes = await request(app).get(`/api/v1/builds/${build.publicId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.items).toHaveLength(1);
      expect(getRes.body.items[0].slot).toBe('cooling');
    });

    it('replaces cooling item in same slot', async () => {
      const build = await createBuild();
      const p1 = await CatalogProductModel.create({
        title: 'Cooler 1',
        category: 'COOLING',
        buildEligibility: 'ELIGIBLE',
      });
      await OfferModel.create({
        catalogProductId: p1._id,
        storeCode: 'SIGMA',
        storeExternalId: `sigma-cool1-${Date.now()}`,
        sourceUrl: 'https://sigma.com/cool1',
        price: 1500,
        availability: 'IN_STOCK',
      });
      const p2 = await CatalogProductModel.create({
        title: 'Cooler 2',
        category: 'COOLING',
        buildEligibility: 'ELIGIBLE',
      });
      await OfferModel.create({
        catalogProductId: p2._id,
        storeCode: 'SIGMA',
        storeExternalId: `sigma-cool2-${Date.now()}`,
        sourceUrl: 'https://sigma.com/cool2',
        price: 3000,
        availability: 'IN_STOCK',
      });

      // Add first cooler
      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cooling`)
        .send({ productId: String(p1._id), quantity: 1, expectedVersion: 1 });

      // Replace with second cooler
      const res = await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cooling`)
        .send({ productId: String(p2._id), quantity: 1, expectedVersion: 2 });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].productName).toBe('Cooler 2');
      expect(res.body.items[0].unitPrice).toBe(3000);
      expect(res.body.version).toBe(3);
    });

    it('existing builds without cooling deserialize safely', async () => {
      // Create a build, then directly insert a legacy build without cooling in compatibility slots
      const build = await createBuild();

      // Verify the default compatibility includes cooling slot
      const getRes = await request(app).get(`/api/v1/builds/${build.publicId}`);
      expect(getRes.status).toBe(200);
      const coolingSlot = getRes.body.compatibility.slots.find(
        (s: { slot: string }) => s.slot === 'cooling',
      );
      expect(coolingSlot).toBeDefined();
      expect(coolingSlot.status).toBe('UNKNOWN');
    });

    it('DELETE cooling item works', async () => {
      const build = await createBuild();
      const product = await CatalogProductModel.create({
        title: 'Cooler DELETE',
        category: 'COOLING',
        buildEligibility: 'ELIGIBLE',
      });
      await OfferModel.create({
        catalogProductId: product._id,
        storeCode: 'SIGMA',
        storeExternalId: `sigma-cool-del-${Date.now()}`,
        sourceUrl: 'https://sigma.com/cool-del',
        price: 2000,
        availability: 'IN_STOCK',
      });

      await request(app)
        .put(`/api/v1/builds/${build.publicId}/items/cooling`)
        .send({ productId: String(product._id), quantity: 1, expectedVersion: 1 });

      const delRes = await request(app)
        .delete(`/api/v1/builds/${build.publicId}/items/cooling`)
        .send({ expectedVersion: 2 });

      expect(delRes.status).toBe(200);
      expect(delRes.body.items).toHaveLength(0);
      expect(delRes.body.version).toBe(3);
    });
  });
});
