import { Types, type ClientSession } from 'mongoose';
import {
  startSession,
  AdminAuditLogModel,
  MatchReviewModel,
  DataQualityIssueModel,
  AdminJobModel,
  CatalogProductModel,
  EligibilityOverrideModel,
  type AdminAuditAction,
} from '@buildsense/database';
import type {
  AdminMatchReviewListResponse,
  AdminMatchReviewDetailResponse,
  AdminMatchReviewLinkRequest,
  AdminMatchReviewIgnoreRequest,
  AdminMatchReviewCreateProductRequest,
  AdminDataQualityIssueListResponse,
  AdminDataQualityIssueDetailResponse,
  AdminDataQualityResolveRequest,
  AdminEligibilityOverrideRequest,
  AdminEligibilityOverrideResponse,
  AdminEligibilityOverrideListResponse,
  AdminEligibilityOverrideDetailResponse,
  AdminJobListResponse,
  AdminJobDetailResponse,
  AdminJobReprocessRequest,
} from '@buildsense/contracts';

// ---------------------------------------------------------------------------
// Reason validation
// ---------------------------------------------------------------------------

const MAX_REASON_LENGTH = 2000;

function validateReason(reason: unknown): string {
  if (typeof reason !== 'string') {
    throw new AdminWriteError('Reason is required', 400);
  }
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new AdminWriteError('Reason must not be empty', 400);
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    throw new AdminWriteError(`Reason must not exceed ${MAX_REASON_LENGTH} characters`, 400);
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// ID validation
// ---------------------------------------------------------------------------

function validateObjectId(id: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AdminWriteError(`Invalid ${label}`, 400);
  }
  return new Types.ObjectId(id);
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class AdminWriteError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AdminWriteError';
  }
}

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

function parsePagination(pageRaw?: string, pageSizeRaw?: string): { page: number; pageSize: number } {
  let page = 1;
  let pageSize = 20;

  if (pageRaw) {
    page = parseInt(pageRaw, 10);
    if (isNaN(page) || page < 1) page = 1;
  }
  if (pageSizeRaw) {
    pageSize = parseInt(pageSizeRaw, 10);
    if (isNaN(pageSize) || pageSize < 1) pageSize = 20;
    if (pageSize > 100) pageSize = 100;
  }

  return { page, pageSize };
}

// ---------------------------------------------------------------------------
// Session / transaction helpers
// ---------------------------------------------------------------------------

/** Return `{ session }` options for Mongoose operations inside a transaction. */
function sessionOpts(session: ClientSession): Record<string, unknown> {
  return { session };
}

/**
 * Execute `fn` inside a MongoDB transaction.  Requires the connected server
 * to support replica-set transactions.  When the server does not support
 * sessions or transactions (e.g. a standalone mongod), the operation fails
 * immediately — no mutation or audit is persisted, and no fallback is attempted.
 */
async function runTransactionally<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await startSession();

  if (!session) {
    throw new AdminWriteError(
      'Transaction support unavailable — operation rejected',
      500,
    );
  }

  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AdminWriteService {
  // -- Audit logging ---------------------------------------------------------

  private async recordAudit(
    params: {
      adminId: Types.ObjectId;
      action: AdminAuditAction;
      targetType: string;
      targetId: Types.ObjectId | null;
      reason: string;
      metadata?: Record<string, unknown>;
      requestId?: string | undefined;
    },
    session: ClientSession,
  ): Promise<void> {
    const doc: Record<string, unknown> = {
      adminId: params.adminId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      metadata: params.metadata ?? {},
    };
    if (params.requestId !== undefined && params.requestId !== '') {
      doc.requestId = params.requestId;
    }
    await AdminAuditLogModel.create([doc], sessionOpts(session));
  }

  // -- Match Reviews ---------------------------------------------------------

  async getMatchReviews(
    pageRaw?: string,
    pageSizeRaw?: string,
    statusFilter?: string,
  ): Promise<AdminMatchReviewListResponse> {
    const { page, pageSize } = parsePagination(pageRaw, pageSizeRaw);
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (statusFilter && ['PENDING', 'LINKED', 'IGNORED', 'CREATED_PRODUCT'].includes(statusFilter)) {
      filter.status = statusFilter;
    }

    const [items, totalItems] = await Promise.all([
      MatchReviewModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      MatchReviewModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => ({
        id: String(item._id),
        rawSnapshotId: String(item.rawSnapshotId),
        canonicalUrl: item.canonicalUrl,
        storeCode: item.storeCode,
        status: item.status,
        flagReason: item.flagReason,
        suggestedCategory: item.suggestedCategory,
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
        resolvedBy: item.resolvedBy ? String(item.resolvedBy) : null,
        resolutionReason: item.resolutionReason,
        linkedProductId: item.linkedProductId ? String(item.linkedProductId) : null,
        createdProductId: item.createdProductId ? String(item.createdProductId) : null,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getMatchReviewDetail(id: string): Promise<AdminMatchReviewDetailResponse | null> {
    const reviewId = validateObjectId(id, 'match review ID');
    const item = await MatchReviewModel.findById(reviewId).lean();
    if (!item) return null;

    return {
      id: String(item._id),
      rawSnapshotId: String(item.rawSnapshotId),
      canonicalUrl: item.canonicalUrl,
      storeCode: item.storeCode,
      status: item.status,
      flagReason: item.flagReason,
      suggestedCategory: item.suggestedCategory,
      resolvedAt: item.resolvedAt?.toISOString() ?? null,
      resolvedBy: item.resolvedBy ? String(item.resolvedBy) : null,
      resolutionReason: item.resolutionReason,
      linkedProductId: item.linkedProductId ? String(item.linkedProductId) : null,
      createdProductId: item.createdProductId ? String(item.createdProductId) : null,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async linkMatchReview(
    id: string,
    dto: AdminMatchReviewLinkRequest,
    adminId: Types.ObjectId,
    requestId?: string,
  ): Promise<void> {
    const reviewId = validateObjectId(id, 'match review ID');
    const productId = validateObjectId(dto.catalogProductId, 'catalog product ID');
    const reason = validateReason(dto.reason);

    // Validate product exists (read-only, no transaction needed for this check)
    const product = await CatalogProductModel.findById(productId);
    if (!product) {
      throw new AdminWriteError('Catalog product not found', 404);
    }

    await runTransactionally(async (session) => {
      // Atomic conditional update — only succeeds when status is PENDING
      const review = await MatchReviewModel.findOneAndUpdate(
        { _id: reviewId, status: 'PENDING' },
        {
          $set: {
            status: 'LINKED',
            linkedProductId: productId,
            resolvedBy: adminId,
            resolvedAt: new Date(),
            resolutionReason: reason,
          },
        },
        { new: true, ...sessionOpts(session) },
      );

      if (!review) {
        const exists = await MatchReviewModel.exists({ _id: reviewId });
        if (!exists) throw new AdminWriteError('Match review not found', 404);
        throw new AdminWriteError('Match review is already resolved', 409);
      }

      await this.recordAudit(
        {
          adminId,
          action: 'match-review.link',
          targetType: 'MatchReview',
          targetId: reviewId,
          reason,
          metadata: {
            catalogProductId: String(productId),
            canonicalUrl: review.canonicalUrl,
          },
          requestId,
        },
        session,
      );
    });
  }

  async ignoreMatchReview(
    id: string,
    dto: AdminMatchReviewIgnoreRequest,
    adminId: Types.ObjectId,
    requestId?: string,
  ): Promise<void> {
    const reviewId = validateObjectId(id, 'match review ID');
    const reason = validateReason(dto.reason);

    await runTransactionally(async (session) => {
      // Atomic conditional update — only succeeds when status is PENDING
      const review = await MatchReviewModel.findOneAndUpdate(
        { _id: reviewId, status: 'PENDING' },
        {
          $set: {
            status: 'IGNORED',
            resolvedBy: adminId,
            resolvedAt: new Date(),
            resolutionReason: reason,
          },
        },
        { new: true, ...sessionOpts(session) },
      );

      if (!review) {
        const exists = await MatchReviewModel.exists({ _id: reviewId });
        if (!exists) throw new AdminWriteError('Match review not found', 404);
        throw new AdminWriteError('Match review is already resolved', 409);
      }

      await this.recordAudit(
        {
          adminId,
          action: 'match-review.ignore',
          targetType: 'MatchReview',
          targetId: reviewId,
          reason,
          metadata: { canonicalUrl: review.canonicalUrl },
          requestId,
        },
        session,
      );
    });
  }

  async createProductFromMatchReview(
    id: string,
    dto: AdminMatchReviewCreateProductRequest,
    adminId: Types.ObjectId,
    requestId?: string,
  ): Promise<string> {
    const reviewId = validateObjectId(id, 'match review ID');
    const reason = validateReason(dto.reason);

    if (!dto.title || typeof dto.title !== 'string' || dto.title.trim().length === 0) {
      throw new AdminWriteError('Title is required', 400);
    }
    if (!dto.category || typeof dto.category !== 'string' || dto.category.trim().length === 0) {
      throw new AdminWriteError('Category is required', 400);
    }

    return runTransactionally(async (session) => {
      // Phase 1: Win the review transition atomically BEFORE creating the product.
      // This prevents duplicate CatalogProduct creation in concurrent requests:
      // only one request will win the findOneAndUpdate (PENDING → CREATED_PRODUCT).
      const review = await MatchReviewModel.findOneAndUpdate(
        { _id: reviewId, status: 'PENDING' },
        {
          $set: {
            status: 'CREATED_PRODUCT',
            resolvedBy: adminId,
            resolvedAt: new Date(),
            resolutionReason: reason,
          },
        },
        { new: true, ...sessionOpts(session) },
      );

      if (!review) {
        const exists = await MatchReviewModel.exists({ _id: reviewId });
        if (!exists) throw new AdminWriteError('Match review not found', 404);
        throw new AdminWriteError('Match review is already resolved', 409);
      }

      // Phase 2: Create the CatalogProduct (safe — no concurrent duplicate possible
      // because only one request won the review transition above).
      const [product] = await CatalogProductModel.create(
        [
          {
            title: dto.title.trim(),
            category: dto.category.trim(),
            brand: dto.brand ?? null,
            buildEligibility: 'ELIGIBLE',
          },
        ],
        sessionOpts(session),
      );

      if (!product) {
        throw new AdminWriteError('Failed to create catalog product', 500);
      }
      const productId = product._id as Types.ObjectId;

      // Phase 3: Link the created product back to the review.
      await MatchReviewModel.findByIdAndUpdate(
        reviewId,
        { $set: { createdProductId: productId } },
        sessionOpts(session),
      );

      // Phase 4: Audit
      await this.recordAudit(
        {
          adminId,
          action: 'match-review.create-product',
          targetType: 'MatchReview',
          targetId: reviewId,
          reason,
          metadata: {
            createdProductId: String(productId),
            productTitle: dto.title.trim(),
            category: dto.category.trim(),
          },
          requestId,
        },
        session,
      );

      return String(productId);
    });
  }

  // -- Data Quality Issues ---------------------------------------------------

  async getDataQualityIssues(
    pageRaw?: string,
    pageSizeRaw?: string,
    statusFilter?: string,
    categoryFilter?: string,
  ): Promise<AdminDataQualityIssueListResponse> {
    const { page, pageSize } = parsePagination(pageRaw, pageSizeRaw);
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (statusFilter && ['OPEN', 'RESOLVED', 'IGNORED'].includes(statusFilter)) {
      filter.status = statusFilter;
    }
    if (categoryFilter) {
      filter.category = categoryFilter;
    }

    const [items, totalItems] = await Promise.all([
      DataQualityIssueModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      DataQualityIssueModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => ({
        id: String(item._id),
        issueType: item.issueType,
        severity: item.severity,
        status: item.status,
        category: item.category,
        catalogProductId: item.catalogProductId ? String(item.catalogProductId) : null,
        rawSnapshotId: item.rawSnapshotId ? String(item.rawSnapshotId) : null,
        description: item.description,
        resolvedBy: item.resolvedBy ? String(item.resolvedBy) : null,
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
        resolutionReason: item.resolutionReason,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getDataQualityIssueDetail(id: string): Promise<AdminDataQualityIssueDetailResponse | null> {
    const issueId = validateObjectId(id, 'data quality issue ID');
    const item = await DataQualityIssueModel.findById(issueId).lean();
    if (!item) return null;

    return {
      id: String(item._id),
      issueType: item.issueType,
      severity: item.severity,
      status: item.status,
      category: item.category,
      catalogProductId: item.catalogProductId ? String(item.catalogProductId) : null,
      rawSnapshotId: item.rawSnapshotId ? String(item.rawSnapshotId) : null,
      description: item.description,
      resolvedBy: item.resolvedBy ? String(item.resolvedBy) : null,
      resolvedAt: item.resolvedAt?.toISOString() ?? null,
      resolutionReason: item.resolutionReason,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async resolveDataQualityIssue(
    id: string,
    dto: AdminDataQualityResolveRequest,
    adminId: Types.ObjectId,
    requestId?: string,
  ): Promise<void> {
    const issueId = validateObjectId(id, 'data quality issue ID');
    const reason = validateReason(dto.reason);

    await runTransactionally(async (session) => {
      // Atomic conditional update — only succeeds when status is OPEN
      const issue = await DataQualityIssueModel.findOneAndUpdate(
        { _id: issueId, status: 'OPEN' },
        {
          $set: {
            status: 'RESOLVED',
            resolvedBy: adminId,
            resolvedAt: new Date(),
            resolutionReason: reason,
          },
        },
        { new: true, ...sessionOpts(session) },
      );

      if (!issue) {
        const exists = await DataQualityIssueModel.exists({ _id: issueId });
        if (!exists) throw new AdminWriteError('Data quality issue not found', 404);
        throw new AdminWriteError('Data quality issue is already resolved', 409);
      }

      await this.recordAudit(
        {
          adminId,
          action: 'data-quality.resolve',
          targetType: 'DataQualityIssue',
          targetId: issueId,
          reason,
          metadata: {
            issueType: issue.issueType,
            severity: issue.severity,
            category: issue.category,
          },
          requestId,
        },
        session,
      );
    });
  }

  // -- Product Eligibility Overrides -----------------------------------------

  async getEligibilityOverrides(
    pageRaw?: string,
    pageSizeRaw?: string,
  ): Promise<AdminEligibilityOverrideListResponse> {
    const { page, pageSize } = parsePagination(pageRaw, pageSizeRaw);
    const skip = (page - 1) * pageSize;

    const [items, totalItems] = await Promise.all([
      EligibilityOverrideModel.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      EligibilityOverrideModel.countDocuments(),
    ]);

    return {
      items: items.map((item) => ({
        id: String(item._id),
        productId: String(item.productId),
        previousEligibility: item.previousEligibility,
        newEligibility: item.newEligibility,
        adminId: String(item.adminId),
        reason: item.reason,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getEligibilityOverrideDetail(id: string): Promise<AdminEligibilityOverrideDetailResponse | null> {
    const overrideId = validateObjectId(id, 'eligibility override ID');
    const item = await EligibilityOverrideModel.findById(overrideId).lean();
    if (!item) return null;

    return {
      id: String(item._id),
      productId: String(item.productId),
      previousEligibility: item.previousEligibility,
      newEligibility: item.newEligibility,
      adminId: String(item.adminId),
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async overrideEligibility(
    productId: string,
    dto: AdminEligibilityOverrideRequest,
    adminId: Types.ObjectId,
    requestId?: string,
  ): Promise<AdminEligibilityOverrideResponse> {
    const id = validateObjectId(productId, 'product ID');

    if (!dto.eligibility || !['ELIGIBLE', 'NOT_ELIGIBLE'].includes(dto.eligibility)) {
      throw new AdminWriteError('Invalid eligibility value', 400);
    }
    const reason = validateReason(dto.reason);

    return runTransactionally(async (session) => {
      // Atomic conditional update — only succeeds when current eligibility
      // differs from the requested value, preventing lost updates.
      // Uses `new: false` to return the document BEFORE the update so we
      // can capture `previousEligibility` for the override record.
      const product = await CatalogProductModel.findOneAndUpdate(
        { _id: id, buildEligibility: { $ne: dto.eligibility } },
        { $set: { buildEligibility: dto.eligibility } },
        { new: false, ...sessionOpts(session) },
      );

      if (!product) {
        const exists = await CatalogProductModel.exists({ _id: id });
        if (!exists) throw new AdminWriteError('Product not found', 404);
        throw new AdminWriteError('Product already has this eligibility', 409);
      }

      const previousEligibility = product.buildEligibility;

      // Persist a dedicated eligibility override record for queryable history
      await EligibilityOverrideModel.create(
        [
          {
            productId: id,
            previousEligibility,
            newEligibility: dto.eligibility,
            adminId,
            reason,
          },
        ],
        sessionOpts(session),
      );

      await this.recordAudit(
        {
          adminId,
          action: 'eligibility.override',
          targetType: 'CatalogProduct',
          targetId: id,
          reason,
          metadata: {
            previousEligibility,
            newEligibility: dto.eligibility,
            productTitle: product.title,
            category: product.category,
          },
          requestId,
        },
        session,
      );

      return {
        ok: true,
        productId: String(id),
        previousEligibility,
        newEligibility: dto.eligibility,
      };
    });
  }

  // -- Admin Jobs (Reprocessing / Backfill) ----------------------------------

  async getJobs(
    pageRaw?: string,
    pageSizeRaw?: string,
    statusFilter?: string,
  ): Promise<AdminJobListResponse> {
    const { page, pageSize } = parsePagination(pageRaw, pageSizeRaw);
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (
      statusFilter &&
      ['PENDING', 'CLAIMED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'].includes(statusFilter)
    ) {
      filter.status = statusFilter;
    }

    const [items, totalItems] = await Promise.all([
      AdminJobModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      AdminJobModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => ({
        id: String(item._id),
        jobType: item.jobType,
        status: item.status,
        requestedBy: String(item.requestedBy),
        reason: item.reason,
        params: item.params as Record<string, unknown>,
        claimedBy: item.claimedBy,
        claimedAt: item.claimedAt?.toISOString() ?? null,
        attempts: item.attempts,
        maxAttempts: item.maxAttempts,
        completedAt: item.completedAt?.toISOString() ?? null,
        result: item.result as Record<string, unknown> | null,
        errorSummary: item.errorSummary,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getJobDetail(id: string): Promise<AdminJobDetailResponse | null> {
    const jobId = validateObjectId(id, 'job ID');
    const item = await AdminJobModel.findById(jobId).lean();
    if (!item) return null;

    return {
      id: String(item._id),
      jobType: item.jobType,
      status: item.status,
      requestedBy: String(item.requestedBy),
      reason: item.reason,
      params: item.params as Record<string, unknown>,
      claimedBy: item.claimedBy,
      claimedAt: item.claimedAt?.toISOString() ?? null,
      attempts: item.attempts,
      maxAttempts: item.maxAttempts,
      completedAt: item.completedAt?.toISOString() ?? null,
      result: item.result as Record<string, unknown> | null,
      errorSummary: item.errorSummary,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async requestReprocessJob(
    dto: AdminJobReprocessRequest,
    adminId: Types.ObjectId,
    requestId?: string,
  ): Promise<string> {
    const reason = validateReason(dto.reason);

    if (!dto.jobType || !['REPROCESS_CATALOG', 'BACKFILL_FACTS', 'REPROCESS_CATEGORY'].includes(dto.jobType)) {
      throw new AdminWriteError('Invalid job type', 400);
    }

    // Deduplication key: prevents duplicate active jobs of the same type+params.
    const paramsKey = JSON.stringify(dto.params ?? {});
    const idempotencyKey = `${dto.jobType}:${paramsKey}`;

    return runTransactionally(async (session) => {
      // The unique index on `idempotencyKey` provides atomic deduplication.
      // Two concurrent requests with the same key: one create succeeds, the
      // other throws Mongo duplicate-key error (code 11000) which we map to 409.
      let job;
      try {
        const [created] = await AdminJobModel.create(
          [
            {
              jobType: dto.jobType,
              status: 'PENDING',
              requestedBy: adminId,
              reason,
              params: dto.params ?? {},
              idempotencyKey,
            },
          ],
          sessionOpts(session),
        );
        job = created;
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
          throw new AdminWriteError('An identical active job already exists', 409);
        }
        throw err;
      }

      if (!job) {
        throw new AdminWriteError('Failed to create admin job', 500);
      }
      const jobId = job._id as Types.ObjectId;

      await this.recordAudit(
        {
          adminId,
          action: 'job.reprocess-requested',
          targetType: 'AdminJob',
          targetId: jobId,
          reason,
          metadata: {
            jobType: dto.jobType,
            params: dto.params ?? {},
          },
          requestId,
        },
        session,
      );

      return String(jobId);
    });
  }
}
