import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  AdminAccountModel,
  AdminSessionModel,
  AdminAuditLogModel,
  MatchReviewModel,
  DataQualityIssueModel,
  AdminJobModel,
  CatalogProductModel,
  RawProductSnapshotModel,
  EligibilityOverrideModel,
  hashPassword,
  generateToken,
  hashToken,
  generateCsrfToken,
  hashCsrfToken,
} from '@buildsense/database';
import { createApp } from '../../app.js';
import { createLogger } from '@buildsense/observability';
import express from 'express';

const WEB_ORIGIN = 'http://localhost:4200';
const COOKIE_CONFIG_DEV = { isDev: true, sessionMaxAgeMs: 24 * 60 * 60 * 1000 };

let mongoReplSet: MongoMemoryReplSet;
let app: express.Express;
let adminId: mongoose.Types.ObjectId;
let sessionTokenHex: string;
let csrfTokenHex: string;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoReplSet.getUri());

  app = createApp({
    isDatabaseConnected: () => true,
    logger: createLogger({ level: 'fatal', name: 'test' }),
    corsOrigin: WEB_ORIGIN,
    cookieConfig: COOKIE_CONFIG_DEV,
    webOrigin: WEB_ORIGIN,
  });

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
  csrfTokenHex = csrfToken.toString('hex');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoReplSet.stop();
});

beforeEach(async () => {
  // Use raw collection to bypass append-only pre-hooks on AdminAuditLogModel
  await mongoose.connection.collection('admin_audit_logs').deleteMany({});
  await MatchReviewModel.deleteMany({});
  await DataQualityIssueModel.deleteMany({});
  await AdminJobModel.deleteMany({});
  await CatalogProductModel.deleteMany({});
  await RawProductSnapshotModel.deleteMany({});
  await EligibilityOverrideModel.deleteMany({});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authCookie(): string {
  return `buildsense_admin_session=${sessionTokenHex}`;
}

function csrfHeaders(): Record<string, string> {
  return {
    Cookie: `buildsense_admin_session=${sessionTokenHex}; buildsense_admin_csrf=${csrfTokenHex}`,
    'X-CSRF-Token': csrfTokenHex,
    Origin: WEB_ORIGIN,
  };
}

async function createMatchReview(overrides?: Partial<{
  canonicalUrl: string;
  flagReason: string;
  status: string;
  suggestedCategory: string | null;
}>): Promise<mongoose.Types.ObjectId> {
  const snapshot = await RawProductSnapshotModel.create({
    storeCode: 'SIGMA',
    canonicalUrl: overrides?.canonicalUrl ?? 'http://sigma.example.com/product/1',
    sourceUrl: overrides?.canonicalUrl ?? 'http://sigma.example.com/product/1',
    scrapeRunId: new mongoose.Types.ObjectId(),
    fetchedAt: new Date(),
    httpStatus: 200,
    contentSha256: 'abc123',
    contentStorage: 'INLINE',
    parserVersion: '1.0.0',
    parseStatus: 'OK',
    raw: { title: 'Test Product' },
  });

  const review = await MatchReviewModel.create({
    rawSnapshotId: snapshot._id,
    canonicalUrl: overrides?.canonicalUrl ?? 'http://sigma.example.com/product/1',
    status: overrides?.status ?? 'PENDING',
    flagReason: overrides?.flagReason ?? 'No matching product found',
    suggestedCategory: overrides?.suggestedCategory ?? null,
  });

  return review._id as mongoose.Types.ObjectId;
}

async function createDataQualityIssue(overrides?: Partial<{
  issueType: string;
  status: string;
  severity: string;
}>): Promise<mongoose.Types.ObjectId> {
  const issue = await DataQualityIssueModel.create({
    issueType: overrides?.issueType ?? 'missing_brand',
    severity: overrides?.severity ?? 'MEDIUM',
    status: overrides?.status ?? 'OPEN',
    description: 'Missing brand information for product',
    category: 'CPU',
  });

  return issue._id as mongoose.Types.ObjectId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin Write API', () => {
  // =========================================================================
  // Authentication / CSRF / Origin
  // =========================================================================

  describe('Security middleware', () => {
    const writeRoutes = [
      { method: 'GET', path: '/api/v1/admin/match-reviews' },
      { method: 'GET', path: '/api/v1/admin/data-quality-issues' },
      { method: 'GET', path: '/api/v1/admin/jobs' },
    ];

    for (const route of writeRoutes) {
      it(`${route.method} ${route.path} returns 401 without session`, async () => {
        const res = await request(app)[route.method.toLowerCase() as 'get'](route.path);
        expect(res.status).toBe(401);
      });
    }

    const postRoutes = [
      '/api/v1/admin/match-reviews/000000000000000000000001/link',
      '/api/v1/admin/match-reviews/000000000000000000000001/ignore',
      '/api/v1/admin/match-reviews/000000000000000000000001/create-product',
      '/api/v1/admin/data-quality-issues/000000000000000000000001/resolve',
      '/api/v1/admin/eligibility/000000000000000000000001/override',
      '/api/v1/admin/jobs/reprocess',
    ];

    for (const path of postRoutes) {
      it(`POST ${path} returns 401 without session`, async () => {
        const res = await request(app).post(path).send({ reason: 'test' });
        expect(res.status).toBe(401);
      });
    }

    for (const path of postRoutes) {
      it(`POST ${path} returns 403 without CSRF token`, async () => {
        const res = await request(app)
          .post(path)
          .set('Cookie', authCookie())
          .set('Origin', WEB_ORIGIN)
          .send({ reason: 'test' });
        expect(res.status).toBe(403);
      });
    }

    for (const path of postRoutes) {
      it(`POST ${path} returns 403 with invalid Origin`, async () => {
        const res = await request(app)
          .post(path)
          .set('Cookie', authCookie())
          .set('Origin', 'http://evil.example.com')
          .set('X-CSRF-Token', csrfTokenHex)
          .send({ reason: 'test' });
        expect(res.status).toBe(403);
      });
    }

    for (const path of postRoutes) {
      it(`POST ${path} returns 403 when Origin header is missing`, async () => {
        const res = await request(app)
          .post(path)
          .set('Cookie', authCookie())
          .set('X-CSRF-Token', csrfTokenHex)
          .send({ reason: 'test' });
        expect(res.status).toBe(403);
      });
    }
  });

  // =========================================================================
  // Match Reviews
  // =========================================================================

  describe('GET /api/v1/admin/match-reviews', () => {
    it('returns paginated list with empty state', async () => {
      const res = await request(app)
        .get('/api/v1/admin/match-reviews')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.pagination.totalItems).toBe(0);
    });

    it('returns match reviews with correct shape', async () => {
      await createMatchReview({ canonicalUrl: 'http://example.com/1' });
      await createMatchReview({ canonicalUrl: 'http://example.com/2' });

      const res = await request(app)
        .get('/api/v1/admin/match-reviews')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.pagination.totalItems).toBe(2);
      expect(res.body.items[0].status).toBe('PENDING');
      expect(res.body.items[0].canonicalUrl).toBeDefined();
      expect(res.body.items[0].flagReason).toBeDefined();
    });

    it('filters by status', async () => {
      const reviewId = await createMatchReview();

      // Resolve it
      await MatchReviewModel.findByIdAndUpdate(reviewId, {
        status: 'IGNORED',
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolutionReason: 'Not needed',
      });

      const res = await request(app)
        .get('/api/v1/admin/match-reviews?status=PENDING')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe('GET /api/v1/admin/match-reviews/:id', () => {
    it('returns match review detail', async () => {
      const reviewId = await createMatchReview();
      const res = await request(app)
        .get(`/api/v1/admin/match-reviews/${reviewId}`)
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(String(reviewId));
      expect(res.body.status).toBe('PENDING');
      expect(res.body.canonicalUrl).toBeDefined();
    });

    it('returns 404 for non-existent review', async () => {
      const fakeId = '000000000000000000000001';
      const res = await request(app)
        .get(`/api/v1/admin/match-reviews/${fakeId}`)
        .set('Cookie', authCookie());
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/admin/match-reviews/:id/link', () => {
    it('links a review to an existing product and creates audit', async () => {
      const reviewId = await createMatchReview();
      const product = await CatalogProductModel.create({
        title: 'Test CPU',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/link`)
        .set(csrfHeaders())
        .send({ catalogProductId: String(product._id), reason: 'Correct match' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const review = await MatchReviewModel.findById(reviewId).lean();
      expect(review?.status).toBe('LINKED');
      expect(String(review?.linkedProductId)).toBe(String(product._id));
      expect(review?.resolutionReason).toBe('Correct match');

      const audit = await AdminAuditLogModel.findOne({
        action: 'match-review.link',
        targetId: reviewId,
      }).lean();
      expect(audit).not.toBeNull();
      expect(audit?.reason).toBe('Correct match');
      expect(String(audit?.adminId)).toBe(String(adminId));
    });

    it('returns 400 without reason', async () => {
      const reviewId = await createMatchReview();
      const product = await CatalogProductModel.create({
        title: 'Test',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/link`)
        .set(csrfHeaders())
        .send({ catalogProductId: String(product._id) });

      expect(res.status).toBe(400);
    });

    it('returns 400 with empty reason', async () => {
      const reviewId = await createMatchReview();
      const product = await CatalogProductModel.create({
        title: 'Test',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/link`)
        .set(csrfHeaders())
        .send({ catalogProductId: String(product._id), reason: '   ' });

      expect(res.status).toBe(400);
    });

    it('returns 409 if review is already resolved', async () => {
      const reviewId = await createMatchReview({ status: 'IGNORED' });
      const product = await CatalogProductModel.create({
        title: 'Test',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/link`)
        .set(csrfHeaders())
        .send({ catalogProductId: String(product._id), reason: 'Test' });

      expect(res.status).toBe(409);
    });

    it('returns 404 for non-existent review', async () => {
      const fakeId = '000000000000000000000001';
      const product = await CatalogProductModel.create({
        title: 'Test',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${fakeId}/link`)
        .set(csrfHeaders())
        .send({ catalogProductId: String(product._id), reason: 'Test' });

      expect(res.status).toBe(404);
    });

    it('returns 400 with invalid product ID', async () => {
      const reviewId = await createMatchReview();

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/link`)
        .set(csrfHeaders())
        .send({ catalogProductId: 'invalid', reason: 'Test' });

      expect(res.status).toBe(400);
    });

    it('returns 404 if product does not exist', async () => {
      const reviewId = await createMatchReview();
      const fakeProductId = '000000000000000000000099';

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/link`)
        .set(csrfHeaders())
        .send({ catalogProductId: fakeProductId, reason: 'Test' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/admin/match-reviews/:id/ignore', () => {
    it('ignores a review and creates audit', async () => {
      const reviewId = await createMatchReview();

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/ignore`)
        .set(csrfHeaders())
        .send({ reason: 'Not a real product' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const review = await MatchReviewModel.findById(reviewId).lean();
      expect(review?.status).toBe('IGNORED');
      expect(review?.resolutionReason).toBe('Not a real product');

      const audit = await AdminAuditLogModel.findOne({
        action: 'match-review.ignore',
        targetId: reviewId,
      }).lean();
      expect(audit).not.toBeNull();
      expect(audit?.reason).toBe('Not a real product');
    });

    it('returns 400 without reason', async () => {
      const reviewId = await createMatchReview();

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/ignore`)
        .set(csrfHeaders())
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/admin/match-reviews/:id/create-product', () => {
    it('creates a product from review and creates audit', async () => {
      const reviewId = await createMatchReview();

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/create-product`)
        .set(csrfHeaders())
        .send({ title: 'New CPU', category: 'CPU', reason: 'Valid product' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.productId).toBeDefined();

      const review = await MatchReviewModel.findById(reviewId).lean();
      expect(review?.status).toBe('CREATED_PRODUCT');
      expect(String(review?.createdProductId)).toBe(res.body.productId);

      const product = await CatalogProductModel.findById(res.body.productId).lean();
      expect(product?.title).toBe('New CPU');
      expect(product?.category).toBe('CPU');
      expect(product?.buildEligibility).toBe('ELIGIBLE');

      const audit = await AdminAuditLogModel.findOne({
        action: 'match-review.create-product',
        targetId: reviewId,
      }).lean();
      expect(audit).not.toBeNull();
      expect(audit?.reason).toBe('Valid product');
      expect((audit?.metadata as Record<string, unknown>)?.productTitle).toBe('New CPU');
    });

    it('returns 400 without title', async () => {
      const reviewId = await createMatchReview();

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/create-product`)
        .set(csrfHeaders())
        .send({ category: 'CPU', reason: 'Test' });

      expect(res.status).toBe(400);
    });

    it('returns 400 without category', async () => {
      const reviewId = await createMatchReview();

      const res = await request(app)
        .post(`/api/v1/admin/match-reviews/${reviewId}/create-product`)
        .set(csrfHeaders())
        .send({ title: 'Test', reason: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // Data Quality Issues
  // =========================================================================

  describe('GET /api/v1/admin/data-quality-issues', () => {
    it('returns paginated list', async () => {
      await createDataQualityIssue();

      const res = await request(app)
        .get('/api/v1/admin/data-quality-issues')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].issueType).toBe('missing_brand');
      expect(res.body.items[0].severity).toBe('MEDIUM');
      expect(res.body.items[0].status).toBe('OPEN');
    });

    it('filters by status', async () => {
      await createDataQualityIssue({ status: 'RESOLVED' });

      const res = await request(app)
        .get('/api/v1/admin/data-quality-issues?status=OPEN')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe('POST /api/v1/admin/data-quality-issues/:id/resolve', () => {
    it('resolves an issue and creates audit', async () => {
      const issueId = await createDataQualityIssue();

      const res = await request(app)
        .post(`/api/v1/admin/data-quality-issues/${issueId}/resolve`)
        .set(csrfHeaders())
        .send({ reason: 'Brand identified as AMD' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const issue = await DataQualityIssueModel.findById(issueId).lean();
      expect(issue?.status).toBe('RESOLVED');
      expect(issue?.resolutionReason).toBe('Brand identified as AMD');

      const audit = await AdminAuditLogModel.findOne({
        action: 'data-quality.resolve',
        targetId: issueId,
      }).lean();
      expect(audit).not.toBeNull();
      expect(audit?.reason).toBe('Brand identified as AMD');
    });

    it('returns 409 if already resolved', async () => {
      const issueId = await createDataQualityIssue({ status: 'RESOLVED' });

      const res = await request(app)
        .post(`/api/v1/admin/data-quality-issues/${issueId}/resolve`)
        .set(csrfHeaders())
        .send({ reason: 'Already resolved' });

      expect(res.status).toBe(409);
    });

    it('returns 400 without reason', async () => {
      const issueId = await createDataQualityIssue();

      const res = await request(app)
        .post(`/api/v1/admin/data-quality-issues/${issueId}/resolve`)
        .set(csrfHeaders())
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // Eligibility Overrides
  // =========================================================================

  describe('POST /api/v1/admin/eligibility/:id/override', () => {
    it('overrides eligibility and creates audit', async () => {
      const product = await CatalogProductModel.create({
        title: 'Test GPU',
        category: 'GPU',
        buildEligibility: 'ELIGIBLE',
      });

      const res = await request(app)
        .post(`/api/v1/admin/eligibility/${product._id}/override`)
        .set(csrfHeaders())
        .send({ eligibility: 'NOT_ELIGIBLE', reason: 'GPU is too old for builder' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.previousEligibility).toBe('ELIGIBLE');
      expect(res.body.newEligibility).toBe('NOT_ELIGIBLE');

      const updated = await CatalogProductModel.findById(product._id).lean();
      expect(updated?.buildEligibility).toBe('NOT_ELIGIBLE');

      // Verify eligibility override record is created
      const override = await EligibilityOverrideModel.findOne({
        productId: product._id,
      }).lean();
      expect(override).not.toBeNull();
      expect(override?.previousEligibility).toBe('ELIGIBLE');
      expect(override?.newEligibility).toBe('NOT_ELIGIBLE');
      expect(String(override?.adminId)).toBe(String(adminId));
      expect(override?.reason).toBe('GPU is too old for builder');

      const audit = await AdminAuditLogModel.findOne({
        action: 'eligibility.override',
        targetId: product._id,
      }).lean();
      expect(audit).not.toBeNull();
      expect(audit?.reason).toBe('GPU is too old for builder');
      expect((audit?.metadata as Record<string, unknown>)?.previousEligibility).toBe('ELIGIBLE');
      expect((audit?.metadata as Record<string, unknown>)?.newEligibility).toBe('NOT_ELIGIBLE');
    });

    it('returns 409 if already at requested eligibility', async () => {
      const product = await CatalogProductModel.create({
        title: 'Test CPU',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      const res = await request(app)
        .post(`/api/v1/admin/eligibility/${product._id}/override`)
        .set(csrfHeaders())
        .send({ eligibility: 'ELIGIBLE', reason: 'Same eligibility' });

      expect(res.status).toBe(409);
    });

    it('returns 400 with invalid eligibility', async () => {
      const product = await CatalogProductModel.create({
        title: 'Test',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      const res = await request(app)
        .post(`/api/v1/admin/eligibility/${product._id}/override`)
        .set(csrfHeaders())
        .send({ eligibility: 'INVALID', reason: 'Test' });

      expect(res.status).toBe(400);
    });

    it('raw snapshots are not modified by eligibility override', async () => {
      const snapshot = await RawProductSnapshotModel.create({
        storeCode: 'SIGMA',
        canonicalUrl: 'http://example.com/product',
        sourceUrl: 'http://example.com/product',
        scrapeRunId: new mongoose.Types.ObjectId(),
        fetchedAt: new Date(),
        httpStatus: 200,
        contentSha256: 'immutable',
        contentStorage: 'INLINE',
        parserVersion: '1.0.0',
        parseStatus: 'OK',
        raw: { title: 'Original' },
      });

      const product = await CatalogProductModel.create({
        title: 'Test',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      await request(app)
        .post(`/api/v1/admin/eligibility/${product._id}/override`)
        .set(csrfHeaders())
        .send({ eligibility: 'NOT_ELIGIBLE', reason: 'Test immutability' });

      const snapshotAfter = await RawProductSnapshotModel.findById(snapshot._id).lean();
      expect(snapshotAfter?.raw.title).toBe('Original');
    });
  });

  // =========================================================================
  // Admin Jobs
  // =========================================================================

  describe('GET /api/v1/admin/jobs', () => {
    it('returns empty list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/jobs')
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });
  });

  describe('POST /api/v1/admin/jobs/reprocess', () => {
    it('creates a reprocess job and audit', async () => {
      const res = await request(app)
        .post('/api/v1/admin/jobs/reprocess')
        .set(csrfHeaders())
        .send({ jobType: 'REPROCESS_CATALOG', reason: 'Need fresh data' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.jobId).toBeDefined();

      const job = await AdminJobModel.findById(res.body.jobId).lean();
      expect(job?.jobType).toBe('REPROCESS_CATALOG');
      expect(job?.status).toBe('PENDING');
      expect(job?.reason).toBe('Need fresh data');
      expect(String(job?.requestedBy)).toBe(String(adminId));

      const audit = await AdminAuditLogModel.findOne({
        action: 'job.reprocess-requested',
        targetId: new mongoose.Types.ObjectId(res.body.jobId),
      }).lean();
      expect(audit).not.toBeNull();
    });

    it('deduplicates active jobs with same type+params', async () => {
      // First request
      const res1 = await request(app)
        .post('/api/v1/admin/jobs/reprocess')
        .set(csrfHeaders())
        .send({ jobType: 'REPROCESS_CATALOG', reason: 'First' });
      expect(res1.status).toBe(200);

      // Duplicate should fail
      const res2 = await request(app)
        .post('/api/v1/admin/jobs/reprocess')
        .set(csrfHeaders())
        .send({ jobType: 'REPROCESS_CATALOG', reason: 'Second' });
      expect(res2.status).toBe(409);
    });

    it('allows different job types', async () => {
      const res1 = await request(app)
        .post('/api/v1/admin/jobs/reprocess')
        .set(csrfHeaders())
        .send({ jobType: 'REPROCESS_CATALOG', reason: 'First' });
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post('/api/v1/admin/jobs/reprocess')
        .set(csrfHeaders())
        .send({ jobType: 'BACKFILL_FACTS', reason: 'Second' });
      expect(res2.status).toBe(200);
    });

    it('returns 400 with invalid job type', async () => {
      const res = await request(app)
        .post('/api/v1/admin/jobs/reprocess')
        .set(csrfHeaders())
        .send({ jobType: 'INVALID', reason: 'Test' });

      expect(res.status).toBe(400);
    });

    it('returns 400 without reason', async () => {
      const res = await request(app)
        .post('/api/v1/admin/jobs/reprocess')
        .set(csrfHeaders())
        .send({ jobType: 'REPROCESS_CATALOG' });

      expect(res.status).toBe(400);
    });

    it('does not execute the job in-request', async () => {
      const res = await request(app)
        .post('/api/v1/admin/jobs/reprocess')
        .set(csrfHeaders())
        .send({ jobType: 'REPROCESS_CATALOG', reason: 'Test deferred execution' });

      expect(res.status).toBe(200);
      const job = await AdminJobModel.findById(res.body.jobId).lean();
      expect(job?.status).toBe('PENDING');
      expect(job?.claimedBy).toBeNull();
      expect(job?.completedAt).toBeNull();
    });
  });

  describe('GET /api/v1/admin/jobs/:id', () => {
    it('returns job detail', async () => {
      const createRes = await request(app)
        .post('/api/v1/admin/jobs/reprocess')
        .set(csrfHeaders())
        .send({ jobType: 'REPROCESS_CATALOG', reason: 'Test' });

      const res = await request(app)
        .get(`/api/v1/admin/jobs/${createRes.body.jobId}`)
        .set('Cookie', authCookie());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.jobId);
      expect(res.body.jobType).toBe('REPROCESS_CATALOG');
      expect(res.body.status).toBe('PENDING');
    });

    it('returns 404 for non-existent job', async () => {
      const fakeId = '000000000000000000000001';
      const res = await request(app)
        .get(`/api/v1/admin/jobs/${fakeId}`)
        .set('Cookie', authCookie());
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // Concurrency — exactly-one-wins with transactional guarantees
  // =========================================================================

  describe('Concurrent match review resolution', () => {
    it('link vs ignore: exactly one wins; loser 409; one final state; one audit', async () => {
      const reviewId = await createMatchReview();
      const product = await CatalogProductModel.create({
        title: 'Link Target',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      const headers = csrfHeaders();
      const [linkRes, ignoreRes] = await Promise.all([
        request(app)
          .post(`/api/v1/admin/match-reviews/${reviewId}/link`)
          .set(headers)
          .send({ catalogProductId: String(product._id), reason: 'Link it' }),
        request(app)
          .post(`/api/v1/admin/match-reviews/${reviewId}/ignore`)
          .set(headers)
          .send({ reason: 'Ignore it' }),
      ]);

      // Exactly one succeeds (200), the other gets 409
      const statuses = [linkRes.status, ignoreRes.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Final state is deterministic — exactly one of LINKED or IGNORED
      const review = await MatchReviewModel.findById(reviewId).lean();
      expect(review?.status === 'LINKED' || review?.status === 'IGNORED').toBe(true);

      // Exactly one audit record for this review
      const audits = await AdminAuditLogModel.find({
        targetType: 'MatchReview',
        targetId: reviewId,
      }).lean();
      expect(audits).toHaveLength(1);
    });

    it('create-product concurrent calls: one product only, one audit, no orphan', async () => {
      const reviewId = await createMatchReview();
      const headers = csrfHeaders();

      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/admin/match-reviews/${reviewId}/create-product`)
          .set(headers)
          .send({ title: 'Product A', category: 'CPU', reason: 'Create A' }),
        request(app)
          .post(`/api/v1/admin/match-reviews/${reviewId}/create-product`)
          .set(headers)
          .send({ title: 'Product B', category: 'GPU', reason: 'Create B' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Review is in CREATED_PRODUCT state
      const review = await MatchReviewModel.findById(reviewId).lean();
      expect(review?.status).toBe('CREATED_PRODUCT');

      // Exactly one product was created
      const products = await CatalogProductModel.find({}).lean();
      expect(products).toHaveLength(1);
      const createdProduct = products[0]!;
      expect(createdProduct.title === 'Product A' || createdProduct.title === 'Product B').toBe(true);

      // The createdProductId on the review matches the actual product
      expect(String(review?.createdProductId)).toBe(String(createdProduct._id));

      // Exactly one audit
      const audits = await AdminAuditLogModel.find({
        action: 'match-review.create-product',
        targetType: 'MatchReview',
        targetId: reviewId,
      }).lean();
      expect(audits).toHaveLength(1);
    });
  });

  describe('Concurrent data-quality resolve', () => {
    it('one success, others 409, one audit', async () => {
      const issueId = await createDataQualityIssue();
      const headers = csrfHeaders();

      const results = await Promise.all([
        request(app)
          .post(`/api/v1/admin/data-quality-issues/${issueId}/resolve`)
          .set(headers)
          .send({ reason: 'Resolve from A' }),
        request(app)
          .post(`/api/v1/admin/data-quality-issues/${issueId}/resolve`)
          .set(headers)
          .send({ reason: 'Resolve from B' }),
        request(app)
          .post(`/api/v1/admin/data-quality-issues/${issueId}/resolve`)
          .set(headers)
          .send({ reason: 'Resolve from C' }),
      ]);

      const statusCounts = results.reduce(
        (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
        {} as Record<number, number>,
      );
      expect(statusCounts[200]).toBe(1);
      expect(statusCounts[409]).toBe(2);

      // Issue is resolved
      const issue = await DataQualityIssueModel.findById(issueId).lean();
      expect(issue?.status).toBe('RESOLVED');

      // Exactly one audit
      const audits = await AdminAuditLogModel.find({
        action: 'data-quality.resolve',
        targetId: issueId,
      }).lean();
      expect(audits).toHaveLength(1);
    });
  });

  describe('Concurrent eligibility overrides', () => {
    it('concurrent differing overrides: optimistic no-lost-update, correct auditing', async () => {
      // Deterministic outcome: ELIGIBLE→NOT_ELIGIBLE vs ELIGIBLE→NOT_ELIGIBLE
      // Both request the same target, so exactly one wins (same-value concurrency).
      const product = await CatalogProductModel.create({
        title: 'Concurrent GPU',
        category: 'GPU',
        buildEligibility: 'ELIGIBLE',
      });

      const headers = csrfHeaders();
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/admin/eligibility/${product._id}/override`)
          .set(headers)
          .send({ eligibility: 'NOT_ELIGIBLE', reason: 'Admin A says not eligible' }),
        request(app)
          .post(`/api/v1/admin/eligibility/${product._id}/override`)
          .set(headers)
          .send({ eligibility: 'NOT_ELIGIBLE', reason: 'Admin B says not eligible' }),
      ]);

      // Both want ELIGIBLE→NOT_ELIGIBLE. Only one succeeds (the other sees
      // the product is already NOT_ELIGIBLE and returns 409).
      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Product ends up NOT_ELIGIBLE (no lost update)
      const updated = await CatalogProductModel.findById(product._id).lean();
      expect(updated?.buildEligibility).toBe('NOT_ELIGIBLE');

      // Exactly one override record
      const overrides = await EligibilityOverrideModel.find({ productId: product._id }).lean();
      expect(overrides).toHaveLength(1);
      const override = overrides[0]!;
      expect(override.previousEligibility).toBe('ELIGIBLE');
      expect(override.newEligibility).toBe('NOT_ELIGIBLE');

      // Exactly one audit
      const audits = await AdminAuditLogModel.find({
        action: 'eligibility.override',
        targetId: product._id,
      }).lean();
      expect(audits).toHaveLength(1);
    });

    it('concurrent opposing overrides: one wins, no lost update', async () => {
      // Two admins concurrently: ELIGIBLE→NOT_ELIGIBLE and ELIGIBLE→NOT_ELIGIBLE
      // The first atomic conditional update wins.
      const product = await CatalogProductModel.create({
        title: 'Opposing GPU',
        category: 'GPU',
        buildEligibility: 'ELIGIBLE',
      });

      const headers = csrfHeaders();

      // Both try to set NOT_ELIGIBLE from ELIGIBLE. Only one atomic
      // findOneAndUpdate succeeds.
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/admin/eligibility/${product._id}/override`)
          .set(headers)
          .send({ eligibility: 'NOT_ELIGIBLE', reason: 'Make it not eligible' }),
        request(app)
          .post(`/api/v1/admin/eligibility/${product._id}/override`)
          .set(headers)
          .send({ eligibility: 'NOT_ELIGIBLE', reason: 'Also not eligible' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Final state is stable
      const finalProduct = await CatalogProductModel.findById(product._id).lean();
      expect(finalProduct?.buildEligibility).toBe('NOT_ELIGIBLE');

      // Exactly one override + audit
      const overrides = await EligibilityOverrideModel.find({ productId: product._id }).lean();
      expect(overrides).toHaveLength(1);
      const audits = await AdminAuditLogModel.find({
        action: 'eligibility.override',
        targetId: product._id,
      }).lean();
      expect(audits).toHaveLength(1);
    });
  });

  describe('Concurrent duplicate job requests', () => {
    it('one job created, loser stable conflict/idempotent response', async () => {
      const headers = csrfHeaders();

      const results = await Promise.all([
        request(app)
          .post('/api/v1/admin/jobs/reprocess')
          .set(headers)
          .send({ jobType: 'REPROCESS_CATALOG', reason: 'Concurrent A' }),
        request(app)
          .post('/api/v1/admin/jobs/reprocess')
          .set(headers)
          .send({ jobType: 'REPROCESS_CATALOG', reason: 'Concurrent B' }),
      ]);

      const statusCounts = results.reduce(
        (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
        {} as Record<number, number>,
      );
      expect(statusCounts[200]).toBe(1);
      expect(statusCounts[409]).toBe(1);

      // Exactly one job in the collection
      const jobs = await AdminJobModel.find({
        jobType: 'REPROCESS_CATALOG',
      }).lean();
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.status).toBe('PENDING');

      // Exactly one audit
      const audits = await AdminAuditLogModel.find({
        action: 'job.reprocess-requested',
      }).lean();
      expect(audits).toHaveLength(1);
    });
  });

  // =========================================================================
  // Audit-write failure rollback
  // =========================================================================

  describe('Audit-write failure rollback', () => {
    it('match-review link rolls back when audit insert fails', async () => {
      const reviewId = await createMatchReview();
      const product = await CatalogProductModel.create({
        title: 'Rollback Target',
        category: 'CPU',
        buildEligibility: 'ELIGIBLE',
      });

      const spy = vi
        .spyOn(AdminAuditLogModel, 'create')
        .mockRejectedValueOnce(new Error('Simulated audit write failure'));

      try {
        const res = await request(app)
          .post(`/api/v1/admin/match-reviews/${reviewId}/link`)
          .set(csrfHeaders())
          .send({ catalogProductId: String(product._id), reason: 'Should rollback' });

        // With a transactional server, the entire transaction rolls back.
        // The controller catches the error from withTransaction and returns 500.
        expect(res.status).toBe(500);
      } finally {
        spy.mockRestore();
      }

      // Mutation was rolled back — review is still PENDING
      const review = await MatchReviewModel.findById(reviewId).lean();
      expect(review?.status).toBe('PENDING');
      expect(review?.linkedProductId).toBeNull();

      // No audit was persisted
      const audits = await AdminAuditLogModel.find({
        action: 'match-review.link',
        targetId: reviewId,
      }).lean();
      expect(audits).toHaveLength(0);
    });

    it('eligibility override rolls back when audit insert fails', async () => {
      const product = await CatalogProductModel.create({
        title: 'Rollback Eligibility',
        category: 'GPU',
        buildEligibility: 'ELIGIBLE',
      });

      const spy = vi
        .spyOn(AdminAuditLogModel, 'create')
        .mockRejectedValueOnce(new Error('Simulated audit write failure'));

      try {
        const res = await request(app)
          .post(`/api/v1/admin/eligibility/${product._id}/override`)
          .set(csrfHeaders())
          .send({ eligibility: 'NOT_ELIGIBLE', reason: 'Should rollback' });

        expect(res.status).toBe(500);
      } finally {
        spy.mockRestore();
      }

      // Product eligibility unchanged
      const updated = await CatalogProductModel.findById(product._id).lean();
      expect(updated?.buildEligibility).toBe('ELIGIBLE');

      // No override record persisted
      const overrides = await EligibilityOverrideModel.find({ productId: product._id }).lean();
      expect(overrides).toHaveLength(0);

      // No audit
      const audits = await AdminAuditLogModel.find({
        action: 'eligibility.override',
        targetId: product._id,
      }).lean();
      expect(audits).toHaveLength(0);
    });

    it('job enqueue rolls back when audit insert fails', async () => {
      const spy = vi
        .spyOn(AdminAuditLogModel, 'create')
        .mockRejectedValueOnce(new Error('Simulated audit write failure'));

      try {
        const res = await request(app)
          .post('/api/v1/admin/jobs/reprocess')
          .set(csrfHeaders())
          .send({ jobType: 'REPROCESS_CATALOG', reason: 'Should rollback' });

        expect(res.status).toBe(500);
      } finally {
        spy.mockRestore();
      }

      // No job persisted
      const jobs = await AdminJobModel.find({ jobType: 'REPROCESS_CATALOG' }).lean();
      expect(jobs).toHaveLength(0);

      // No audit
      const audits = await AdminAuditLogModel.find({
        action: 'job.reprocess-requested',
      }).lean();
      expect(audits).toHaveLength(0);
    });
  });

  // =========================================================================
  // Audit Log Integrity
  // =========================================================================

  describe('AdminAuditLog', () => {
    it('append-only: updates are prevented at schema level', async () => {
      const audit = await AdminAuditLogModel.create({
        adminId,
        action: 'match-review.link',
        targetType: 'MatchReview',
        targetId: new mongoose.Types.ObjectId(),
        reason: 'Test',
        metadata: {},
      });

      await expect(
        AdminAuditLogModel.findByIdAndUpdate(audit._id, { reason: 'Hacked' }),
      ).rejects.toThrow('append-only');
    });

    it('append-only: deletes are prevented at schema level', async () => {
      const audit = await AdminAuditLogModel.create({
        adminId,
        action: 'data-quality.resolve',
        targetType: 'DataQualityIssue',
        targetId: new mongoose.Types.ObjectId(),
        reason: 'Test',
        metadata: {},
      });

      await expect(
        AdminAuditLogModel.findByIdAndDelete(audit._id),
      ).rejects.toThrow('append-only');
    });

    it('never records secrets or raw snapshot content', async () => {
      await request(app)
        .post('/api/v1/admin/jobs/reprocess')
        .set(csrfHeaders())
        .send({ jobType: 'REPROCESS_CATALOG', reason: 'Audit content check' });

      const audits = await AdminAuditLogModel.find({}).lean();
      expect(audits.length).toBeGreaterThan(0);

      for (const audit of audits) {
        const serialized = JSON.stringify(audit);
        expect(serialized).not.toContain('password');
        expect(serialized).not.toContain('csrfToken');
        expect(serialized).not.toContain('sessionToken');
        expect(serialized).not.toContain('cookie');
      }
    });
  });

  // =========================================================================
  // Raw Snapshot Immutability
  // =========================================================================

  describe('Raw snapshot immutability', () => {
    it('no write action modifies raw snapshot data', async () => {
      const snapshot = await RawProductSnapshotModel.create({
        storeCode: 'SIGMA',
        canonicalUrl: 'http://example.com/immutable',
        sourceUrl: 'http://example.com/immutable',
        scrapeRunId: new mongoose.Types.ObjectId(),
        fetchedAt: new Date(),
        httpStatus: 200,
        contentSha256: 'immutable-hash',
        contentStorage: 'INLINE',
        parserVersion: '1.0.0',
        parseStatus: 'OK',
        raw: { title: 'Immutable Product', brandText: 'BrandX' },
      });

      const review = await MatchReviewModel.create({
        rawSnapshotId: snapshot._id,
        canonicalUrl: 'http://example.com/immutable',
        status: 'PENDING',
        flagReason: 'Test',
      });

      // Ignore the review
      await request(app)
        .post(`/api/v1/admin/match-reviews/${review._id}/ignore`)
        .set(csrfHeaders())
        .send({ reason: 'Not needed' });

      const snapshotAfter = await RawProductSnapshotModel.findById(snapshot._id).lean();
      expect(snapshotAfter?.raw.title).toBe('Immutable Product');
      expect(snapshotAfter?.raw.brandText).toBe('BrandX');
      expect(snapshotAfter?.contentSha256).toBe('immutable-hash');
    });
  });

  // =========================================================================
  // E2E Security Flow: login → read → write → audit → logout
  // =========================================================================

  describe('E2E security flow', () => {
    it('completes login → dashboard read → data-quality resolve → audit verify → logout', async () => {
      // --- Step 1: Create a fresh admin account ---
      const e2eEmail = 'e2e-security@example.com';
      const e2ePassword = 'e2e-test-password-123';
      const hashResult = await hashPassword(e2ePassword);
      const e2eAdmin = await AdminAccountModel.create({
        email: e2eEmail,
        role: 'ADMIN',
        passwordHash: hashResult.passwordHash,
        passwordSalt: hashResult.passwordSalt,
        scryptParams: hashResult.scryptParams,
        hashVersion: hashResult.hashVersion,
      });

      // --- Step 2: Login via POST /api/v1/admin/auth/login ---
      const loginRes = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: e2eEmail, password: e2ePassword });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.ok).toBe(true);

      // Extract session and CSRF cookies
      const setCookie = loginRes.headers['set-cookie'] as unknown as string[];
      const sessionMatch = setCookie.find((c) => c.startsWith('buildsense_admin_session='));
      const csrfMatch = setCookie.find((c) => c.startsWith('buildsense_admin_csrf='));
      expect(sessionMatch).toBeDefined();
      expect(csrfMatch).toBeDefined();

      const sessionToken = sessionMatch!.split(';')[0]!.split('=')[1]!;
      const csrfToken = csrfMatch!.split(';')[0]!.split('=')[1]!;

      // --- Step 3: GET /api/v1/admin/auth/me — verify session works ---
      const meRes = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Cookie', `buildsense_admin_session=${sessionToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe(e2eEmail);
      expect(meRes.body.role).toBe('ADMIN');

      // --- Step 4: GET /api/v1/admin/dashboard — read protected route ---
      const dashboardRes = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', `buildsense_admin_session=${sessionToken}`);

      expect(dashboardRes.status).toBe(200);
      expect(dashboardRes.body).toHaveProperty('scrapeRuns');
      expect(dashboardRes.body).toHaveProperty('catalog');
      expect(dashboardRes.body).toHaveProperty('worker');

      // --- Step 5: GET /api/v1/admin/data-quality-issues — read protected route ---
      const issuesRes = await request(app)
        .get('/api/v1/admin/data-quality-issues')
        .set('Cookie', `buildsense_admin_session=${sessionToken}`);

      expect(issuesRes.status).toBe(200);
      expect(issuesRes.body).toHaveProperty('items');
      expect(Array.isArray(issuesRes.body.items)).toBe(true);

      // --- Step 6: Create a data quality issue in the database ---
      const issue = await DataQualityIssueModel.create({
        issueType: 'missing_brand',
        severity: 'MEDIUM',
        status: 'OPEN',
        description: 'E2E test issue — missing brand info',
        category: 'CPU',
      });

      // --- Step 7: Resolve the data quality issue with reason (write action) ---
      const resolveRes = await request(app)
        .post(`/api/v1/admin/data-quality-issues/${issue._id}/resolve`)
        .set('Cookie', `buildsense_admin_session=${sessionToken}; buildsense_admin_csrf=${csrfToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', WEB_ORIGIN)
        .send({ reason: 'E2E test resolution — brand identified as AMD' });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.ok).toBe(true);

      // --- Step 8: Verify audit log entry exists with correct fields ---
      const audits = await AdminAuditLogModel.find({
        adminId: e2eAdmin._id,
      }).lean();

      expect(audits.length).toBeGreaterThanOrEqual(1);
      const resolveAudit = audits.find(
        (a) => a.action === 'data-quality.resolve',
      );
      expect(resolveAudit).toBeDefined();
      expect(String(resolveAudit!.targetId)).toBe(String(issue._id));
      expect(String(resolveAudit!.adminId)).toBe(String(e2eAdmin._id));
      expect(resolveAudit!.reason).toBe('E2E test resolution — brand identified as AMD');
      expect(resolveAudit!.timestamp).toBeDefined();

      // --- Step 9: Logout ---
      const logoutRes = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Cookie', `buildsense_admin_session=${sessionToken}; buildsense_admin_csrf=${csrfToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', WEB_ORIGIN);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.ok).toBe(true);

      // --- Step 10: Verify session is revoked — /me returns 401 ---
      const meAfterLogout = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Cookie', `buildsense_admin_session=${sessionToken}`);

      expect(meAfterLogout.status).toBe(401);

      // --- Step 11: Verify write routes return 401 after logout ---
      const writeAfterLogout = await request(app)
        .get('/api/v1/admin/data-quality-issues')
        .set('Cookie', `buildsense_admin_session=${sessionToken}`);

      expect(writeAfterLogout.status).toBe(401);
    });
  });
});
