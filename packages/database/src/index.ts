export { connectDatabase, disconnectDatabase, isDatabaseConnected } from './client.js';

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
export type { ScrapeRunDocument, CategoryAuditEntry, ScrapeRunStatus, ScrapeRunStage, ScrapeRunMode } from './models/scrape-run.js';
export type { ScrapeRunItemDocument, ItemFetchState, ScrapeFailureKind } from './models/scrape-run-item.js';
export type { RawProductSnapshotDocument } from './models/raw-product-snapshot.js';
export { CatalogProductModel, type CatalogProduct, type CatalogProductDocument } from './models/catalog-product.js';
export { OfferModel, type Offer, type OfferDocument } from './models/offer.js';
// Worker lock
export { WorkerLock } from './models/worker-lock.js';
