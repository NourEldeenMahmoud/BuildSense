export { connectDatabase, disconnectDatabase, isDatabaseConnected, startSession } from './client.js';

// Repository classes
export { ScrapeRunRepository } from './repositories/scrape-run-repository.js';
export type { CreateScrapeRunInput, UpdateScrapeRunInput } from './repositories/scrape-run-repository.js';

export { ScrapeRunItemRepository } from './repositories/scrape-run-item-repository.js';
export type { CreateScrapeRunItemInput, UpdateScrapeRunItemInput } from './repositories/scrape-run-item-repository.js';

export { RawProductSnapshotRepository } from './repositories/raw-product-snapshot-repository.js';
export type { CreateRawProductSnapshotInput } from './repositories/raw-product-snapshot-repository.js';

export { DiscoveredProductRepository } from './repositories/discovered-product-repository.js';
export type { UpsertDiscoveredProductInput } from './repositories/discovered-product-repository.js';

// Model types
export { ScrapeRunModel } from './models/scrape-run.js';
export type { ScrapeRunDocument, CategoryAuditEntry, ScrapeRunStatus, ScrapeRunStage, ScrapeRunMode } from './models/scrape-run.js';

export { ScrapeRunItemModel } from './models/scrape-run-item.js';
export type { ScrapeRunItemDocument, ItemFetchState, ScrapeFailureKind } from './models/scrape-run-item.js';

export { RawProductSnapshotModel } from './models/raw-product-snapshot.js';
export type { RawProductSnapshotDocument } from './models/raw-product-snapshot.js';
export { CatalogProductModel, type CatalogProduct, type CatalogProductDocument } from './models/catalog-product.js';
export { OfferModel, type Offer, type OfferDocument } from './models/offer.js';

// Offer repository
export { OfferRepository } from './repositories/offer-repository.js';
export type { CreateOfferInput, UpsertOfferInput } from './repositories/offer-repository.js';

export { DiscoveredProductModel } from './models/discovered-product.js';

// Worker lock
export { WorkerLockModel, WorkerLock } from './models/worker-lock.js';

export { BuildModel, type Build, type BuildDocument } from './models/build.js';
export type { BuildItem, BuildCompatibility, BuildCompatibilitySlot, BuildPricing } from './models/build.js';

export { CategoryQualityReportModel, type CategoryQualityReport, type CategoryQualityReportDocument, type FactQualityMetrics } from './models/category-quality-report.js';

export { ReferenceDatasetModel, type ReferenceDataset, type ReferenceDatasetDocument, type ChipsetCpuSupportEntry } from './models/reference-dataset.js';

// Admin auth
export { AdminAccountModel, type AdminAccountDocument, type ScryptParams, SCRYPT_PARAMS_V1, CURRENT_HASH_VERSION, hashPassword, verifyPassword, type HashPasswordResult } from './models/admin-account.js';
export { AdminSessionModel, type AdminSessionDocument, generateToken, hashToken, generateCsrfToken, hashCsrfToken, timingSafeEqualBuffers } from './models/admin-session.js';

// Admin audit & write models
export { AdminAuditLogModel, type AdminAuditLogDocument, type AdminAuditAction } from './models/admin-audit-log.js';
export { MatchReviewModel, type MatchReviewDocument, type MatchReviewStatus } from './models/match-review.js';
export { DataQualityIssueModel, type DataQualityIssueDocument, type DataQualitySeverity, type DataQualityIssueStatus } from './models/data-quality-issue.js';
export { AdminJobModel, type AdminJobDocument, type AdminJobType, type AdminJobStatus } from './models/admin-job.js';
export { EligibilityOverrideModel, type EligibilityOverrideDocument } from './models/eligibility-override.js';

export { BuildRepository } from './repositories/build-repository.js';
export type { CreateBuildInput, ReplaceItemInput, MutateBuildResult } from './repositories/build-repository.js';

// Compatibility facts & quality repositories
export { CatalogProductRepository } from './repositories/catalog-product-repository.js';
export type { CompatibilityFactSet as PersistedFactSet, PersistFactsResult, IterateBatchOptions } from './repositories/catalog-product-repository.js';
export { parseExtractorVersion, compareExtractorVersions } from './repositories/catalog-product-repository.js';
export { CategoryQualityReportRepository, evaluateFactGate } from './repositories/category-quality-report-repository.js';
export type { UpsertQualityReportInput, FactExtractionStats, FactGateResult } from './repositories/category-quality-report-repository.js';

// Migration primitives
export { migrationDryRun, migrationRun, migrationVerify } from './migrations/compatibility-facts-migration.js';
export type { MigrationDryRunResult, MigrationRunResult } from './migrations/compatibility-facts-migration.js';
