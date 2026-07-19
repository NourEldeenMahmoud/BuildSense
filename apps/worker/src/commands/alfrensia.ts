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
import { AlfrensiaScraperAdapter } from '@buildsense/alfrensia-adapter';
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
  const adapter = new AlfrensiaScraperAdapter(env.ALFRENSIA_BASE_URL);
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
    baseUrl: env.ALFRENSIA_BASE_URL,
    lockTtlMs: 300000,
    maxPagesPerCategory: env.ALFRENSIA_MAX_PAGES_PER_CATEGORY,
    maxRetries: env.ALFRENSIA_MAX_RETRIES,
    requestTimeoutMs: env.ALFRENSIA_REQUEST_TIMEOUT_MS,
    requestsPerMinute: env.ALFRENSIA_REQUESTS_PER_MINUTE,
    maxConcurrency: env.ALFRENSIA_MAX_CONCURRENCY,
    userAgent: env.ALFRENSIA_USER_AGENT,
    dryRun,
    ...(onProductPublished !== undefined && { onProductPublished }),
  });
}

async function runAlfrensiaCommand(
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
      'Alfrensia command failed',
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

const alfrensiaFullCommand = new Command('full')
  .description('Run full discovery + fetch across all enabled categories')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .action(async (options: { runId?: string }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'alfrensia:full',
    });

    await runAlfrensiaCommand(async () => {
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
        'Alfrensia full run completed',
      );
    }, logger);
  });

const alfrensiaCategoryCommand = new Command('category')
  .description('Run discovery + fetch for a specific category seed')
  .argument('<seed-id>', 'Category seed ID (e.g., monitor)')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .action(async (seedId: string, options: { runId?: string }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'alfrensia:category',
    });

    await runAlfrensiaCommand(async () => {
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
        'Alfrensia category run completed',
      );
    }, logger);
  });

const alfrensiaUrlCommand = new Command('url')
  .description('Fetch and snapshot a single Alfrensia product URL')
  .argument('<url>', 'Alfrensia product URL')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .option('--dry-run', 'Parse without persisting snapshots')
  .action(async (url: string, options: { runId?: string; dryRun?: boolean }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'alfrensia:url',
    });

    await runAlfrensiaCommand(async () => {
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
        'Alfrensia URL run completed',
      );
    }, logger);
  });

const alfrensiaImportUrlCommand = new Command('import-url')
  .description('Import a single Alfrensia product URL with optional publish')
  .argument('<url>', 'Alfrensia product URL')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .option('--dry-run', 'Parse without persisting snapshots')
  .option('--publish', 'After snapshot, attempt to publish into catalog + offers')
  .action(async (url: string, options: { runId?: string; dryRun?: boolean; publish?: boolean }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'alfrensia:import-url',
    });

    await runAlfrensiaCommand(async () => {
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
            storeCode: event.storeCode as 'ALFRENSIA',
            externalId: event.externalId ?? '',
            canonicalUrl: event.canonicalUrl,
            sourceUrl: event.sourceUrl,
            category: resolveCategoryFromBreadcrumbs(event.raw.breadcrumbs, 'MONITOR'),
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
        'Alfrensia import-url run completed',
      );
    }, logger);
  });

const alfrensiaPublishSnapshotCommand = new Command('publish-snapshot')
  .description('Publish an existing successful raw snapshot into catalog + offers (no network)')
  .argument('<snapshot-id>', 'MongoDB ObjectId of the raw snapshot to publish')
  .action(async (snapshotId: string) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'alfrensia:publish-snapshot',
    });

    await runAlfrensiaCommand(async () => {
      const { StoreProductPublisher } = await import('../services/store-product-publisher.js');

      const snapshotRepository = new RawProductSnapshotRepository();
      const snapshot = await snapshotRepository.findById(snapshotId);

      if (!snapshot) {
        throw new Error(`Raw snapshot not found: ${snapshotId}`);
      }
      if (snapshot.storeCode !== 'ALFRENSIA') {
        throw new Error(
          `Snapshot storeCode mismatch: expected ALFRENSIA, got ${snapshot.storeCode}`,
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

const alfrensiaImportCapturesCommand = new Command('import-captures')
  .description('Import browser-captured HTML files from a manifest (no network)')
  .argument('<manifest-path>', 'Path to the browser-capture manifest JSON')
  .option('--publish', 'After snapshot, attempt to publish into catalog + offers')
  .action(async (manifestPath: string, options: { publish?: boolean }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'alfrensia:import-captures',
    });

    await runAlfrensiaCommand(async () => {
      const { SnapshotStore } = await import('@buildsense/scraping-core');
      const { executeBrowserCaptureImport } = await import('../services/browser-capture-import.js');
      const adapter = new AlfrensiaScraperAdapter(env.ALFRENSIA_BASE_URL);
      const snapshotBaseDir = path.resolve(env.SCRAPER_SNAPSHOT_DIR);
      const snapshotStore = new SnapshotStore(snapshotBaseDir);

      const result = await executeBrowserCaptureImport(
        {
          storeCode: 'ALFRENSIA',
          storeHost: new URL(env.ALFRENSIA_BASE_URL).hostname,
          adapter,
          snapshotStore,
          runRepository: new ScrapeRunRepository(),
          itemRepository: new ScrapeRunItemRepository(),
          snapshotRepository: new RawProductSnapshotRepository(),
          discoveredProductRepository: new DiscoveredProductRepository(),
          catalogProductRepository: new CatalogProductRepository(),
          offerRepository: new OfferRepository(),
        },
        {
          manifestPath,
          publish: options.publish ?? false,
        },
      );

      logger.info(
        {
          runId: result.runId,
          totalEntries: result.totalEntries,
          parsed: result.parsed,
          parseFailed: result.parseFailed,
          published: result.published,
          publishSkipped: result.publishSkipped,
          validationFailed: result.validationFailed,
          duplicatesSkipped: result.duplicatesSkipped,
          snapshotsExisted: result.snapshotsExisted,
          pages: result.pages,
        },
        'Alfrensia browser-capture import completed',
      );
    }, logger);
  });

export const alfrensiaCommand = new Command('alfrensia')
  .description('Alfrensia store scraper commands')
  .addCommand(alfrensiaFullCommand)
  .addCommand(alfrensiaCategoryCommand)
  .addCommand(alfrensiaUrlCommand)
  .addCommand(alfrensiaImportUrlCommand)
  .addCommand(alfrensiaPublishSnapshotCommand)
  .addCommand(alfrensiaImportCapturesCommand);
