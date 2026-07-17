export { ScrapeRunModel, type ScrapeRunDocument, type CategoryAuditEntry } from './scrape-run.js';
export type { ScrapeRunStatus, ScrapeRunStage, ScrapeRunMode } from './scrape-run.js';

export { ScrapeRunItemModel, type ScrapeRunItemDocument } from './scrape-run-item.js';
export type { ItemFetchState, ScrapeFailureKind } from './scrape-run-item.js';

export { RawProductSnapshotModel, type RawProductSnapshotDocument } from './raw-product-snapshot.js';
export type { ContentStorage, ParseStatus } from './raw-product-snapshot.js';

export { WorkerLockModel, WorkerLock, type WorkerLockDocument } from './worker-lock.js';
export type { AcquireLockInput } from './worker-lock.js';

export { DiscoveredProductModel, type DiscoveredProductDocument } from './discovered-product.js';

export { CatalogProductModel, type CatalogProduct, type CatalogProductDocument } from './catalog-product.js';
export { OfferModel, type Offer, type OfferDocument } from './offer.js';

export { BuildModel, type Build, type BuildDocument } from './build.js';
export type { BuildItem, BuildCompatibility, BuildCompatibilitySlot, BuildPricing } from './build.js';

export { CategoryQualityReportModel, type CategoryQualityReport, type CategoryQualityReportDocument, type FactQualityMetrics } from './category-quality-report.js';

export { ReferenceDatasetModel, type ReferenceDataset, type ReferenceDatasetDocument, type ChipsetCpuSupportEntry } from './reference-dataset.js';

// Admin auth
export { AdminAccountModel, type AdminAccountDocument, type ScryptParams, SCRYPT_PARAMS_V1, CURRENT_HASH_VERSION, hashPassword, verifyPassword, type HashPasswordResult } from './admin-account.js';
export { AdminSessionModel, type AdminSessionDocument, generateToken, hashToken, generateCsrfToken, hashCsrfToken, timingSafeEqualBuffers } from './admin-session.js';

// Admin audit & write models
export { AdminAuditLogModel, type AdminAuditLogDocument, type AdminAuditAction } from './admin-audit-log.js';
export { MatchReviewModel, type MatchReviewDocument, type MatchReviewStatus } from './match-review.js';
export { DataQualityIssueModel, type DataQualityIssueDocument, type DataQualitySeverity, type DataQualityIssueStatus } from './data-quality-issue.js';
export { AdminJobModel, type AdminJobDocument, type AdminJobType, type AdminJobStatus } from './admin-job.js';
export { EligibilityOverrideModel, type EligibilityOverrideDocument } from './eligibility-override.js';

// Repositories — compatibility facts & quality
export { CatalogProductRepository } from '../repositories/catalog-product-repository.js';
export type { CompatibilityFactSet as PersistedFactSet, PersistFactsResult, IterateBatchOptions } from '../repositories/catalog-product-repository.js';
export { CategoryQualityReportRepository } from '../repositories/category-quality-report-repository.js';
export type { UpsertQualityReportInput, FactExtractionStats, FactGateResult } from '../repositories/category-quality-report-repository.js';
export { evaluateFactGate } from '../repositories/category-quality-report-repository.js';

// Migration
export { migrationDryRun, migrationRun, migrationVerify } from '../migrations/compatibility-facts-migration.js';
export type { MigrationDryRunResult, MigrationRunResult } from '../migrations/compatibility-facts-migration.js';
