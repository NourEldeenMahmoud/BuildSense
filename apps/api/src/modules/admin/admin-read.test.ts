import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AdminAccountModel,
  AdminSessionModel,
  ScrapeRunModel,
  ScrapeRunItemModel,
  CatalogProductModel,
  OfferModel,
  CategoryQualityReportModel,
  ReferenceDatasetModel,
  WorkerLockModel,
  DiscoveredProductModel,
  hashPassword,
  generateToken,
  hashToken,
  generateCsrfToken,
  hashCsrfToken,
} from '@buildsense/database';
import { createLogger } from '@buildsense/observability';
import express from 'express';

const WEB_ORIGIN = 'http://localhost:4200';
const COOKIE_CONFIG_DEV = { isDev: true, sessionMaxAgeMs: 24 * 60 * 60 * 1000 };

let mongoServer: MongoMemoryServer;
let app: express.Express;
let adminId: mongoose.Types.ObjectId;
let sessionTokenHex: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = createApp({
    isDatabaseConnected: () => true,
    logger: createLogger({ level: 'fatal', name: 'test' }),
    corsOrigin: WEB_ORIGIN,
    cookieConfig: COOKIE_CONFIG_DEV,
    webOrigin: WEB_ORIGIN,
  });

  // Create test admin
  const hashResult = await hashPassword('password123');
  const admin = await AdminAccountModel.create({
    email: 'admin@example.com',
    role: 'ADMIN',
    passwordHash: hashResult.passwordHash,
    passwordSalt: hashResult.passwordSalt,
    scryptParams: hashResult.scryptParams,
    hashVersion: hashResult.hashVersion,
  });
  adminId = admin._id as mongoose.Types.ObjectId;

  // Create test session
  const token = generateToken();
  const tokenHash = hashToken(token);
  const csrfToken = generateCsrfToken();
  const csrfTokenHash = hashCsrfToken(csrfToken);
  const now = new Date();

  await AdminSessionModel.create({
    adminId,
    tokenHash,
    csrfTokenHash,
    expiresAt: new Date(now.getTime() + 86400000),
    lastUsedAt: now,
  });

  sessionTokenHex = token.toString('hex');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ScrapeRunModel.deleteMany({});
  await ScrapeRunItemModel.deleteMany({});
  await CategoryQualityReportModel.deleteMany({});
  await ReferenceDatasetModel.deleteMany({});
  await WorkerLockModel.deleteMany({});
  await DiscoveredProductModel.deleteMany({});
  await CatalogProductModel.deleteMany({});
  await OfferModel.deleteMany({});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authCookie(): string {
  return `buildsense_admin_session=${sessionTokenHex}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin Read API', () => {
  describe('Authentication required', () => {
    const readRoutes = [
      { method: 'GET', path: '/api/v1/admin/dashboard' },
      { method: 'GET', path: '/api/v1/admin/scrape-runs' },
      { method: 'GET', path: '/api/v1/admin/compatibility-quality' },
      { method: 'GET', path: '/api/v1/admin/worker-status' },
      { method: 'GET', path: '/api/v1/admin/reference-datasets' },
      { method: 'GET', path: '/api/v1/admin/catalog-stats' },
    ];

    for (const route of readRoutes) {
      it(`${route.method} ${route.path} returns 401 without session`, async () => {
        const res = await request(app)[route.method.toLowerCase() as 'get'](route.path);
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
      });
    }

    it('GET /api/v1/admin/scrape-runs/:id returns 401 without session', async () => {
      const fakeId = '000000000000000000000001';
      const res = await request(app).get(`/api/v1/admin/scrape-runs/${fakeId}`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/admin/dashboard', () => {
    it('returns dashboard with empty state', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        scrapeRuns: { total: 0, lastRunAt: null },
        catalog: { totalProducts: 0, totalOffers: 0, totalDiscovered: 0 },
        compatibilityQuality: {
          totalCategories: 0,
          allGatesPassCount: 0,
          allGatesFailCount: 0,
        },
        referenceDatasets: { total: 0 },
        worker: { activeLocks: 0 },
      });
    });

    it('returns real aggregate counts', async () => {
      const now = new Date();

      await ScrapeRunModel.create({
        runId: 'run-1',
        mode: 'FULL',
        status: 'SUCCEEDED',
        stage: 'FETCH',
        storeCode: 'SIGMA',
        summary: { totalDiscovered: 10, totalFetched: 8, totalFailed: 2 },
        startedAt: now,
        completedAt: now,
      });

      await CatalogProductModel.create({
        title: 'Test CPU',
        category: 'CPU',
        brand: 'AMD',
        model: 'Ryzen 5',
        buildEligibility: 'ELIGIBLE',
      });

      await CatalogProductModel.create({
        title: 'Test GPU',
        category: 'GPU',
        brand: 'NVIDIA',
        model: 'RTX 4070',
        buildEligibility: 'NOT_ELIGIBLE',
      });

      await OfferModel.create({
        catalogProductId: new mongoose.Types.ObjectId(),
        storeCode: 'SIGMA',
        storeExternalId: 'ext-1',
        sourceUrl: 'http://example.com',
        price: 5000,
        currency: 'EGP',
        availability: 'IN_STOCK',
      });

      await CategoryQualityReportModel.create({
        category: 'CPU',
        extractorVersion: '1.0.0',
        totalProducts: 50,
        factMetrics: [],
        allGatesPass: true,
        evaluatedAt: now,
      });

      await ReferenceDatasetModel.create({
        version: 'v1',
        publishedAt: now,
        chipsetCpuSupport: [
          { chipset: 'B550', supportedFamilies: ['AM4'], biosUpdateRequired: [], source: 'test', verifiedAt: now },
        ],
        citation: 'test citation',
      });

      const lock = new WorkerLockModel();
      lock.lockKey = 'SIGMA_MUTATING_RUN';
      lock.owner = 'test-worker';
      lock.expiresAt = new Date(now.getTime() + 60000);
      await lock.save();

      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.scrapeRuns.total).toBe(1);
      expect(res.body.scrapeRuns.lastRunAt).toBeDefined();
      expect(res.body.catalog.totalProducts).toBe(2);
      expect(res.body.catalog.totalOffers).toBe(1);
      expect(res.body.compatibilityQuality.totalCategories).toBe(1);
      expect(res.body.compatibilityQuality.allGatesPassCount).toBe(1);
      expect(res.body.compatibilityQuality.allGatesFailCount).toBe(0);
      expect(res.body.referenceDatasets.total).toBe(1);
      expect(res.body.worker.activeLocks).toBe(1);
    });
  });

  describe('GET /api/v1/admin/scrape-runs', () => {
    it('returns paginated list with empty state', async () => {
      const res = await request(app)
        .get('/api/v1/admin/scrape-runs')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.pagination).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
      });
    });

    it('returns paginated scrape runs with correct shape', async () => {
      const now = new Date();
      await ScrapeRunModel.create({
        runId: 'run-1',
        mode: 'FULL',
        status: 'SUCCEEDED',
        stage: 'FETCH',
        storeCode: 'SIGMA',
        summary: { totalDiscovered: 10, totalFetched: 8, totalFailed: 2 },
        startedAt: now,
        completedAt: now,
      });
      await ScrapeRunModel.create({
        runId: 'run-2',
        mode: 'CATEGORY',
        status: 'RUNNING',
        stage: 'DISCOVERY',
        storeCode: 'SIGMA',
      });

      const res = await request(app)
        .get('/api/v1/admin/scrape-runs?page=1&pageSize=1')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.pagination.totalItems).toBe(2);
      expect(res.body.pagination.totalPages).toBe(2);
      expect(res.body.items[0].runId).toBeDefined();
      expect(res.body.items[0].status).toBeDefined();
    });

    it('rejects invalid page parameter', async () => {
      const res = await request(app)
        .get('/api/v1/admin/scrape-runs?page=abc')
        .set('Cookie', authCookie());

      expect(res.status).toBe(400);
    });

    it('caps pageSize at 100', async () => {
      const res = await request(app)
        .get('/api/v1/admin/scrape-runs?pageSize=200')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.pagination.pageSize).toBe(100);
    });
  });

  describe('GET /api/v1/admin/scrape-runs/:id', () => {
    it('returns 404 for non-existent run', async () => {
      const fakeId = '000000000000000000000001';
      const res = await request(app)
        .get(`/api/v1/admin/scrape-runs/${fakeId}`)
        .set('Cookie', authCookie());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Scrape run not found');
    });

    it('returns run detail with failures', async () => {
      const now = new Date();
      const run = await ScrapeRunModel.create({
        runId: 'run-detail',
        mode: 'FULL',
        status: 'PARTIALLY_FAILED',
        stage: 'FETCH',
        storeCode: 'SIGMA',
        summary: { totalDiscovered: 5, totalFetched: 3, totalFailed: 2 },
        categoryAudit: [
          { seedId: 'cpu-seed', pagesProcessed: 10, productsDiscovered: 3, completed: true },
          { seedId: 'gpu-seed', pagesProcessed: 5, productsDiscovered: 2, completed: false, failureKind: 'NETWORK' },
        ],
        startedAt: now,
        completedAt: now,
      });

      await ScrapeRunItemModel.create({
        scrapeRunId: run._id,
        canonicalUrl: 'http://example.com/product1',
        fetchState: 'FAILED',
        failureKind: 'NETWORK',
        attempts: 3,
      });
      await ScrapeRunItemModel.create({
        scrapeRunId: run._id,
        canonicalUrl: 'http://example.com/product2',
        fetchState: 'FAILED',
        failureKind: 'TIMEOUT',
        attempts: 2,
      });
      await ScrapeRunItemModel.create({
        scrapeRunId: run._id,
        canonicalUrl: 'http://example.com/product3',
        fetchState: 'FETCHED',
        attempts: 1,
      });

      const res = await request(app)
        .get(`/api/v1/admin/scrape-runs/${String(run._id)}`)
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.runId).toBe('run-detail');
      expect(res.body.status).toBe('PARTIALLY_FAILED');
      expect(res.body.failures).toHaveLength(2);
      expect(res.body.failures[0].failureKind).toBe('NETWORK');
      expect(res.body.failures[1].failureKind).toBe('TIMEOUT');
      expect(res.body.categoryAudit).toHaveLength(2);
      expect(res.body.summary.totalFailed).toBe(2);
    });

    it('returns 400 for invalid ID format', async () => {
      const res = await request(app)
        .get('/api/v1/admin/scrape-runs/invalid')
        .set('Cookie', authCookie());

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/admin/compatibility-quality', () => {
    it('returns empty list when no reports exist', async () => {
      const res = await request(app)
        .get('/api/v1/admin/compatibility-quality')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });

    it('returns quality reports with correct shape', async () => {
      const now = new Date();
      await CategoryQualityReportModel.create({
        category: 'CPU',
        extractorVersion: '1.0.0',
        totalProducts: 50,
        factMetrics: [
          { factKey: 'socket', extractableCount: 45, coverage: 0.9, verifiedCorrect: 40, verifiedSampleSize: 45, precision: 0.889 },
          { factKey: 'tdp', extractableCount: 30, coverage: 0.6, verifiedCorrect: null, verifiedSampleSize: null, precision: null },
        ],
        allGatesPass: false,
        evaluatedAt: now,
      });

      await CategoryQualityReportModel.create({
        category: 'GPU',
        extractorVersion: '1.0.0',
        totalProducts: 30,
        factMetrics: [
          { factKey: 'vram', extractableCount: 30, coverage: 1.0, verifiedCorrect: 29, verifiedSampleSize: 30, precision: 0.967 },
        ],
        allGatesPass: true,
        evaluatedAt: now,
      });

      const res = await request(app)
        .get('/api/v1/admin/compatibility-quality')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].category).toBe('CPU');
      expect(res.body.items[0].allGatesPass).toBe(false);
      expect(res.body.items[0].factMetrics).toHaveLength(2);
      expect(res.body.items[1].category).toBe('GPU');
      expect(res.body.items[1].allGatesPass).toBe(true);
    });
  });

  describe('GET /api/v1/admin/worker-status', () => {
    it('returns empty active locks when none exist', async () => {
      const res = await request(app)
        .get('/api/v1/admin/worker-status')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.activeLocks).toEqual([]);
    });

    it('returns only non-expired locks', async () => {
      const now = new Date();

      // Active lock
      const lock1 = new WorkerLockModel();
      lock1.lockKey = 'SIGMA_MUTATING_RUN';
      lock1.owner = 'worker-1';
      lock1.expiresAt = new Date(now.getTime() + 60000);
      await lock1.save();

      // Expired lock (should not appear)
      const lock2 = new WorkerLockModel();
      lock2.lockKey = 'OLD_LOCK';
      lock2.owner = 'worker-old';
      lock2.expiresAt = new Date(now.getTime() - 60000);
      await lock2.save();

      const res = await request(app)
        .get('/api/v1/admin/worker-status')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.activeLocks).toHaveLength(1);
      expect(res.body.activeLocks[0].lockKey).toBe('SIGMA_MUTATING_RUN');
      expect(res.body.activeLocks[0].owner).toBe('worker-1');
    });
  });

  describe('GET /api/v1/admin/reference-datasets', () => {
    it('returns empty list when no datasets exist', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reference-datasets')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });

    it('returns datasets with chipset count', async () => {
      const now = new Date();
      await ReferenceDatasetModel.create({
        version: 'v2',
        publishedAt: now,
        chipsetCpuSupport: [
          { chipset: 'B550', supportedFamilies: ['AM4'], biosUpdateRequired: [], source: 'test', verifiedAt: now },
          { chipset: 'X570', supportedFamilies: ['AM4'], biosUpdateRequired: [], source: 'test', verifiedAt: now },
        ],
        citation: 'Test citation',
      });

      await ReferenceDatasetModel.create({
        version: 'v1',
        publishedAt: new Date(now.getTime() - 86400000),
        chipsetCpuSupport: [],
        citation: 'Old citation',
      });

      const res = await request(app)
        .get('/api/v1/admin/reference-datasets')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      // Sorted by publishedAt desc
      expect(res.body.items[0].version).toBe('v2');
      expect(res.body.items[0].chipsetCount).toBe(2);
      expect(res.body.items[1].version).toBe('v1');
      expect(res.body.items[1].chipsetCount).toBe(0);
    });
  });

  describe('GET /api/v1/admin/catalog-stats', () => {
    it('returns zero stats when catalog is empty', async () => {
      const res = await request(app)
        .get('/api/v1/admin/catalog-stats')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.totalProducts).toBe(0);
      expect(res.body.totalOffers).toBe(0);
      expect(res.body.totalDiscovered).toBe(0);
      expect(res.body.productsByCategory).toEqual([]);
      expect(res.body.productsByEligibility).toEqual({ eligible: 0, notEligible: 0 });
    });

    it('returns real catalog statistics', async () => {
      await CatalogProductModel.create({
        title: 'AMD Ryzen 5 7600X',
        category: 'CPU',
        brand: 'AMD',
        model: '7600X',
        buildEligibility: 'ELIGIBLE',
      });
      await CatalogProductModel.create({
        title: 'AMD Ryzen 7 7800X3D',
        category: 'CPU',
        brand: 'AMD',
        model: '7800X3D',
        buildEligibility: 'ELIGIBLE',
      });
      await CatalogProductModel.create({
        title: 'NVIDIA RTX 4070',
        category: 'GPU',
        brand: 'NVIDIA',
        model: 'RTX 4070',
        buildEligibility: 'NOT_ELIGIBLE',
      });

      await DiscoveredProductModel.create({
        storeCode: 'SIGMA',
        canonicalUrl: 'http://example.com/1',
        firstDiscoveredAt: new Date(),
        lastDiscoveredAt: new Date(),
        lastScrapeRunId: new mongoose.Types.ObjectId(),
      });

      const res = await request(app)
        .get('/api/v1/admin/catalog-stats')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.totalProducts).toBe(3);
      expect(res.body.totalDiscovered).toBe(1);
      expect(res.body.productsByCategory).toEqual([
        { category: 'CPU', count: 2 },
        { category: 'GPU', count: 1 },
      ]);
      expect(res.body.productsByEligibility).toEqual({ eligible: 2, notEligible: 1 });
    });
  });

  describe('Error contract', () => {
    it('returns 401 with standard error shape for unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('requestId');
    });
  });
});
