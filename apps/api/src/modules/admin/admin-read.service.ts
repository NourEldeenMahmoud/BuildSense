import {
  ScrapeRunModel,
  ScrapeRunItemModel,
  CatalogProductModel,
  OfferModel,
  CategoryQualityReportModel,
  ReferenceDatasetModel,
  WorkerLockModel,
  DiscoveredProductModel,
} from '@buildsense/database';
import type {
  AdminDashboardResponse,
  AdminScrapeRunListResponse,
  AdminScrapeRunDetailResponse,
  AdminCompatibilityQualityResponse,
  AdminWorkerStatusResponse,
  AdminReferenceDatasetListResponse,
  AdminCatalogStatsResponse,
} from '@buildsense/contracts';

// ---------------------------------------------------------------------------
// Read-only admin service
// ---------------------------------------------------------------------------

export class AdminReadService {
  // -- Dashboard -------------------------------------------------------------

  async getDashboard(): Promise<AdminDashboardResponse> {
    const now = new Date();

    const [
      totalScrapeRuns,
      lastScrapeRun,
      totalProducts,
      totalOffers,
      totalDiscovered,
      qualityReports,
      totalReferenceDatasets,
      activeLocks,
    ] = await Promise.all([
      ScrapeRunModel.countDocuments(),
      ScrapeRunModel.findOne().sort({ createdAt: -1 }).select('createdAt').lean(),
      CatalogProductModel.countDocuments(),
      OfferModel.countDocuments(),
      DiscoveredProductModel.countDocuments(),
      CategoryQualityReportModel.find().select('allGatesPass').lean(),
      ReferenceDatasetModel.countDocuments(),
      WorkerLockModel.countDocuments({ expiresAt: { $gt: now } }),
    ]);

    const allGatesPassCount = qualityReports.filter((r) => r.allGatesPass).length;
    const allGatesFailCount = qualityReports.length - allGatesPassCount;

    return {
      scrapeRuns: {
        total: totalScrapeRuns,
        lastRunAt: lastScrapeRun?.createdAt?.toISOString() ?? null,
      },
      catalog: {
        totalProducts,
        totalOffers,
        totalDiscovered,
      },
      compatibilityQuality: {
        totalCategories: qualityReports.length,
        allGatesPassCount,
        allGatesFailCount,
      },
      referenceDatasets: {
        total: totalReferenceDatasets,
      },
      worker: {
        activeLocks,
      },
    };
  }

  // -- Scrape Runs -----------------------------------------------------------

  async getScrapeRuns(
    page: number,
    pageSize: number,
  ): Promise<AdminScrapeRunListResponse> {
    const skip = (page - 1) * pageSize;

    const [items, totalItems] = await Promise.all([
      ScrapeRunModel.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      ScrapeRunModel.countDocuments(),
    ]);

    return {
      items: items.map((run) => ({
        id: String(run._id),
        runId: run.runId,
        storeCode: run.storeCode,
        mode: run.mode,
        status: run.status,
        stage: run.stage,
        summary: run.summary ?? null,
        startedAt: run.startedAt?.toISOString() ?? null,
        completedAt: run.completedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getScrapeRunDetail(id: string): Promise<AdminScrapeRunDetailResponse | null> {
    const run = await ScrapeRunModel.findById(id).lean();
    if (!run) return null;

    const failures = await ScrapeRunItemModel.find({
      scrapeRunId: run._id,
      fetchState: 'FAILED',
    })
      .select('canonicalUrl fetchState failureKind attempts categorySeedId')
      .lean();

    return {
      id: String(run._id),
      runId: run.runId,
      storeCode: run.storeCode,
      mode: run.mode,
      status: run.status,
      stage: run.stage,
      summary: run.summary ?? null,
      categoryAudit: run.categoryAudit ?? null,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
      failures: failures.map((f) => ({
        canonicalUrl: f.canonicalUrl,
        fetchState: f.fetchState,
        failureKind: f.failureKind ?? null,
        attempts: f.attempts,
        categorySeedId: f.categorySeedId ?? null,
      })),
    };
  }

  // -- Compatibility Quality -------------------------------------------------

  async getCompatibilityQuality(): Promise<AdminCompatibilityQualityResponse> {
    const reports = await CategoryQualityReportModel.find()
      .sort({ category: 1 })
      .lean();

    return {
      items: reports.map((r) => ({
        category: r.category,
        extractorVersion: r.extractorVersion,
        totalProducts: r.totalProducts,
        factMetrics: r.factMetrics.map((fm) => ({
          factKey: fm.factKey,
          extractableCount: fm.extractableCount,
          coverage: fm.coverage,
          verifiedCorrect: fm.verifiedCorrect,
          verifiedSampleSize: fm.verifiedSampleSize,
          precision: fm.precision,
        })),
        allGatesPass: r.allGatesPass,
        evaluatedAt: r.evaluatedAt.toISOString(),
      })),
    };
  }

  // -- Worker Status ---------------------------------------------------------

  async getWorkerStatus(): Promise<AdminWorkerStatusResponse> {
    const now = new Date();
    const locks = await WorkerLockModel.find({
      expiresAt: { $gt: now },
    })
      .select('lockKey owner expiresAt')
      .lean();

    return {
      activeLocks: locks.map((l) => ({
        lockKey: l.lockKey,
        owner: l.owner,
        expiresAt: l.expiresAt.toISOString(),
      })),
    };
  }

  // -- Reference Datasets ----------------------------------------------------

  async getReferenceDatasets(): Promise<AdminReferenceDatasetListResponse> {
    const datasets = await ReferenceDatasetModel.find()
      .sort({ publishedAt: -1 })
      .lean();

    return {
      items: datasets.map((d) => ({
        version: d.version,
        publishedAt: d.publishedAt.toISOString(),
        citation: d.citation,
        chipsetCount: d.chipsetCpuSupport.length,
      })),
    };
  }

  // -- Catalog Stats ---------------------------------------------------------

  async getCatalogStats(): Promise<AdminCatalogStatsResponse> {
    const [totalProducts, totalOffers, totalDiscovered, productsByCategory, eligibilityCounts] =
      await Promise.all([
        CatalogProductModel.countDocuments(),
        OfferModel.countDocuments(),
        DiscoveredProductModel.countDocuments(),
        CatalogProductModel.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, category: '$_id', count: 1 } },
        ]),
        CatalogProductModel.aggregate([
          { $group: { _id: '$buildEligibility', count: { $sum: 1 } } },
        ]),
      ]);

    const eligibilityMap: Record<string, number> = {};
    for (const entry of eligibilityCounts) {
      eligibilityMap[entry._id] = entry.count;
    }

    return {
      totalProducts,
      totalOffers,
      totalDiscovered,
      productsByCategory,
      productsByEligibility: {
        eligible: eligibilityMap['ELIGIBLE'] ?? 0,
        notEligible: eligibilityMap['NOT_ELIGIBLE'] ?? 0,
      },
    };
  }
}
