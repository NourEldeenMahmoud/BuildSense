import { validateEnv, parseWorkerEnv } from '@buildsense/config';
import {
  connectDatabase,
  disconnectDatabase,
  ScrapeRunRepository,
  ScrapeRunItemRepository,
  RawProductSnapshotRepository,
  DiscoveredProductRepository,
  WorkerLock,
  CatalogProductRepository,
  OfferRepository,
} from '@buildsense/database';
import { ElBadrScraperAdapter } from '@buildsense/el-badr-adapter';
import { createLogger } from '@buildsense/observability';
import { Command } from 'commander';
import * as path from 'node:path';
import { resolveCategoryFromBreadcrumbs } from '../services/store-product-publisher.js';

type Env = ReturnType<typeof validateEnv> & ReturnType<typeof parseWorkerEnv>;

async function createOrchestrator(
  env: Env,
  dryRun: boolean,
  onProductPublished?: import('@buildsense/scraping-core').OrchestratorConfig['onProductPublished'],
): Promise<import('@buildsense/scraping-core').Orchestrator> {
  const { Orchestrator, SnapshotStore } = await import('@buildsense/scraping-core');
  const adapter = new ElBadrScraperAdapter(env.EL_BADR_BASE_URL);
  const snapshotStore = new SnapshotStore(path.resolve(env.SCRAPER_SNAPSHOT_DIR));
  const runRepository = new ScrapeRunRepository();
  const itemRepository = new ScrapeRunItemRepository();
  const snapshotRepository = new RawProductSnapshotRepository();
  const discoveredProductRepository = new DiscoveredProductRepository();
  const workerLock = new WorkerLock();

  return new Orchestrator({
    adapter,
    snapshotStore,
    runRepository,
    itemRepository,
    snapshotRepository,
    discoveredProductRepository,
    workerLock,
    baseUrl: env.EL_BADR_BASE_URL,
    lockTtlMs: 300000,
    maxPagesPerCategory: env.EL_BADR_MAX_PAGES_PER_CATEGORY,
    maxRetries: env.EL_BADR_MAX_RETRIES,
    requestTimeoutMs: env.EL_BADR_REQUEST_TIMEOUT_MS,
    requestsPerMinute: env.EL_BADR_REQUESTS_PER_MINUTE,
    maxConcurrency: env.EL_BADR_MAX_CONCURRENCY,
    userAgent: env.EL_BADR_USER_AGENT,
    dryRun,
    ...(onProductPublished !== undefined && { onProductPublished }),
  });
}

async function runElBadrCommand(
  commandFn: () => Promise<void>,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const env = { ...validateEnv(), ...parseWorkerEnv(process.env) };
  let failed = false;

  try {
    await connectDatabase(env.MONGO_URI, env.MONGO_DB_NAME);
    logger.info('Connected to MongoDB');

    await commandFn();
  } catch (error) {
    failed = true;
    logger.error(
      {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'El Badr command failed',
    );
  } finally {
    try {
      await disconnectDatabase();
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      failed = true;
      logger.error(
        {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        'MongoDB disconnect failed',
      );
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

function resolveEnv(): Env {
  return { ...validateEnv(), ...parseWorkerEnv(process.env) };
}

const elBadrFullCommand = new Command('full')
  .description('Run full discovery + fetch across all enabled categories')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .action(async (options: { runId?: string }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'el-badr:full',
    });

    await runElBadrCommand(async () => {
      const orchestrator = await createOrchestrator(env, false);
      const runCommand: import('@buildsense/scraping-core').RunCommand = {
        mode: 'FULL',
        ...(options.runId !== undefined && { runId: options.runId }),
      };
      const result = await orchestrator.executeRun(runCommand);

      logger.info(
        {
          runId: result.runId,
          status: result.status,
          discovered: result.summary.totalDiscovered,
          fetched: result.summary.totalFetched,
          failed: result.summary.totalFailed,
        },
        'El Badr full run completed',
      );
    }, logger);
  });

const elBadrCategoryCommand = new Command('category')
  .description('Run discovery + fetch for a specific category seed')
  .argument('<seed-id>', 'Category seed ID (e.g., cpu)')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .action(async (seedId: string, options: { runId?: string }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'el-badr:category',
    });

    await runElBadrCommand(async () => {
      const orchestrator = await createOrchestrator(env, false);
      const runCommand: import('@buildsense/scraping-core').RunCommand = {
        mode: 'CATEGORY',
        seedId,
        ...(options.runId !== undefined && { runId: options.runId }),
      };
      const result = await orchestrator.executeRun(runCommand);

      logger.info(
        {
          runId: result.runId,
          status: result.status,
          seedId,
          discovered: result.summary.totalDiscovered,
          fetched: result.summary.totalFetched,
          failed: result.summary.totalFailed,
        },
        'El Badr category run completed',
      );
    }, logger);
  });

const elBadrUrlCommand = new Command('url')
  .description('Fetch and snapshot a single El Badr product URL')
  .argument('<url>', 'El Badr product URL')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .option('--dry-run', 'Parse without persisting snapshots')
  .action(async (url: string, options: { runId?: string; dryRun?: boolean }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'el-badr:url',
    });

    await runElBadrCommand(async () => {
      const orchestrator = await createOrchestrator(env, options.dryRun ?? false);
      const runCommand: import('@buildsense/scraping-core').RunCommand = {
        mode: 'URL',
        url,
        ...(options.runId !== undefined && { runId: options.runId }),
        ...(options.dryRun !== undefined && { dryRun: options.dryRun }),
      };
      const result = await orchestrator.executeRun(runCommand);

      logger.info(
        {
          runId: result.runId,
          status: result.status,
          url,
          dryRun: options.dryRun,
          fetched: result.summary.totalFetched,
          failed: result.summary.totalFailed,
        },
        'El Badr URL run completed',
      );
    }, logger);
  });

const elBadrImportUrlCommand = new Command('import-url')
  .description('Import a single El Badr product URL with optional publish')
  .argument('<url>', 'El Badr product URL')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .option('--dry-run', 'Parse without persisting snapshots')
  .option('--publish', 'After snapshot, attempt to publish into catalog + offers')
  .action(async (url: string, options: { runId?: string; dryRun?: boolean; publish?: boolean }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'el-badr:import-url',
    });

    await runElBadrCommand(async () => {
      const { StoreProductPublisher } = await import('../services/store-product-publisher.js');

      // Build the publisher hook if --publish is requested
      let hook: import('@buildsense/scraping-core').OrchestratorConfig['onProductPublished'] | undefined;
      const publishResults: Array<{ kind: string; reason?: string | undefined; productId?: string | undefined; offerId?: string | undefined }> = [];

      if (options.publish && !options.dryRun) {
        const catalogProductRepository = new CatalogProductRepository();
        const offerRepository = new OfferRepository();
        const snapshotRepository = new RawProductSnapshotRepository();
        const publisher = new StoreProductPublisher({
          catalogProductRepository,
          offerRepository,
          snapshotRepository,
        });

        hook = async (event: import('@buildsense/scraping-core').ProductPublishedEvent) => {
          const result = await publisher.publish({
            storeCode: event.storeCode as 'EL_BADR',
            externalId: event.externalId ?? '',
            canonicalUrl: event.canonicalUrl,
            sourceUrl: event.sourceUrl,
            category: resolveCategoryFromBreadcrumbs(event.raw.breadcrumbs, 'CPU'),
            title: event.raw.title ?? '',
            brand: event.raw.brandText ?? null,
            model: event.raw.modelText ?? null,
            mpn: event.raw.partNumberText ?? null,
            imageUrl: event.raw.imageUrls[0] ?? null,
            priceText: event.raw.priceText ?? null,
            availabilityText: event.raw.availabilityText ?? null,
            rawSpecifications: event.raw.specifications,
          });

          publishResults.push({
            kind: result.kind,
            reason: result.reason,
            productId: result.productId,
            offerId: result.offerId,
          });

          logger.info(
            { publishKind: result.kind, reason: result.reason, productId: result.productId, offerId: result.offerId },
            'Publisher result',
          );
        };
      }

      const orchestrator = await createOrchestrator(env, options.dryRun ?? false, hook);
      const runCommand: import('@buildsense/scraping-core').RunCommand = {
        mode: 'URL',
        url,
        ...(options.runId !== undefined && { runId: options.runId }),
        ...(options.dryRun !== undefined && { dryRun: options.dryRun }),
      };
      const result = await orchestrator.executeRun(runCommand);

      logger.info(
        {
          runId: result.runId,
          status: result.status,
          url,
          dryRun: options.dryRun,
          publish: options.publish,
          fetched: result.summary.totalFetched,
          failed: result.summary.totalFailed,
          publishResults,
        },
        'El Badr import-url run completed',
      );
    }, logger);
  });

const elBadrLiveSampleCommand = new Command('live-sample')
  .description('Fetch and parse a live El Badr product page (no persistence)')
  .option('--url <url>', 'El Badr product URL to fetch')
  .action(async (options: { url?: string }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'el-badr:live-sample',
    });

    await runElBadrCommand(async () => {
      const adapter = new ElBadrScraperAdapter(env.EL_BADR_BASE_URL);
      const url =
        options.url ??
        'https://elbadrgroupeg.store/amd-ryzen-5-8600g-tray-desktop-processor';

      logger.info({ url }, 'Fetching live sample');

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const result = await adapter.parseProductPage({
        url,
        html,
        scrapeRunId: 'live-sample',
      });

      logger.info(
        {
          externalId: result.externalId,
          canonicalUrl: result.canonicalUrl,
          title: result.raw.title,
          price: result.raw.priceText,
          brand: result.raw.brandText,
          model: result.raw.modelText,
          mpn: result.raw.partNumberText,
          specCount: result.raw.specifications.length,
          warningCount: result.warnings.length,
        },
        'Live sample parsed successfully',
      );

      if (result.warnings.length > 0) {
        logger.warn({ warnings: result.warnings }, 'Parse warnings detected');
      }
    }, logger);
  });

const elBadrPublishSnapshotCommand = new Command('publish-snapshot')
  .description('Publish an existing successful raw snapshot into catalog + offers (no network)')
  .argument('<snapshot-id>', 'MongoDB ObjectId of the raw snapshot to publish')
  .action(async (snapshotId: string) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'el-badr:publish-snapshot',
    });

    await runElBadrCommand(async () => {
      const { StoreProductPublisher } = await import('../services/store-product-publisher.js');

      const snapshotRepository = new RawProductSnapshotRepository();
      const snapshot = await snapshotRepository.findById(snapshotId);

      if (!snapshot) {
        throw new Error(`Raw snapshot not found: ${snapshotId}`);
      }
      if (snapshot.storeCode !== 'EL_BADR') {
        throw new Error(
          `Snapshot storeCode mismatch: expected EL_BADR, got ${snapshot.storeCode}`,
        );
      }
      if (snapshot.parseStatus !== 'OK') {
        throw new Error(
          `Snapshot parseStatus must be OK, got ${snapshot.parseStatus}`,
        );
      }

      // Validate required raw fields for publisher
      const { raw } = snapshot;
      if (!raw.title || raw.title.trim().length === 0) {
        throw new Error('Snapshot raw.title is empty — cannot publish');
      }
      if (!raw.breadcrumbs || raw.breadcrumbs.length === 0) {
        throw new Error('Snapshot raw.breadcrumbs is empty — cannot publish');
      }

      const catalogProductRepository = new CatalogProductRepository();
      const offerRepository = new OfferRepository();
      const publisher = new StoreProductPublisher({
        catalogProductRepository,
        offerRepository,
        snapshotRepository,
      });

      const result = await publisher.publish({
        storeCode: snapshot.storeCode,
        externalId: snapshot.externalId ?? '',
        canonicalUrl: snapshot.canonicalUrl,
        sourceUrl: snapshot.sourceUrl,
        category: resolveCategoryFromBreadcrumbs(raw.breadcrumbs, 'UNCATEGORIZED'),
        title: raw.title,
        brand: raw.brandText ?? null,
        model: raw.modelText ?? null,
        mpn: raw.partNumberText ?? null,
        imageUrl: raw.imageUrls[0] ?? null,
        priceText: raw.priceText ?? null,
        availabilityText: raw.availabilityText ?? null,
        rawSpecifications: raw.specifications,
      });

      logger.info(
        {
          snapshotId,
          externalId: snapshot.externalId,
          canonicalUrl: snapshot.canonicalUrl,
          publishKind: result.kind,
          reason: result.reason,
          productId: result.productId,
          offerId: result.offerId,
        },
        'Publish snapshot result',
      );
    }, logger);
  });

export const elBadrCommand = new Command('el-badr')
  .description('El Badr Group store scraper commands')
  .addCommand(elBadrFullCommand)
  .addCommand(elBadrCategoryCommand)
  .addCommand(elBadrUrlCommand)
  .addCommand(elBadrImportUrlCommand)
  .addCommand(elBadrPublishSnapshotCommand)
  .addCommand(elBadrLiveSampleCommand);
