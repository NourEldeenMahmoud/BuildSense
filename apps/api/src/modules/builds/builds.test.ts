import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CatalogProductModel, OfferModel, BuildModel } from '@buildsense/database';
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
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedCpu(overrides?: { title?: string; price?: number; buildEligibility?: string }) {
  const product = await CatalogProductModel.create({
    title: overrides?.title ?? 'AMD Ryzen 5 7600',
    category: 'CPU',
    brand: 'AMD',
    buildEligibility: overrides?.buildEligibility ?? 'ELIGIBLE',
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

    it('returns 404 when product has no SIGMA offer', async () => {
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
});
