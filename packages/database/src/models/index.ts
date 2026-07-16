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
