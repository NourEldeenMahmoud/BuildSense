import { validateEnv, parseWorkerEnv } from '@buildsense/config';
import {
  connectDatabase,
  disconnectDatabase,
  ScrapeRunRepository,
  ScrapeRunItemRepository,
  RawProductSnapshotRepository,
  DiscoveredProductRepository,
  WorkerLock,
} from '@buildsense/database';
import { SigmaScraperAdapter } from '@buildsense/sigma-adapter';
import { createLogger } from '@buildsense/observability';
import { Command } from 'commander';
import * as path from 'node:path';

type Env = ReturnType<typeof validateEnv> & ReturnType<typeof parseWorkerEnv>;

async function createOrchestrator(
  env: Env,
  dryRun: boolean,
): Promise<import('@buildsense/scraping-core').Orchestrator> {
  const { Orchestrator, SnapshotStore } = await import('@buildsense/scraping-core');
  const adapter = new SigmaScraperAdapter(env.SIGMA_BASE_URL);
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
    baseUrl: env.SIGMA_BASE_URL,
    lockTtlMs: 300000,
    maxPagesPerCategory: env.SIGMA_MAX_PAGES_PER_CATEGORY,
    maxRetries: env.SIGMA_MAX_RETRIES,
    requestTimeoutMs: env.SIGMA_REQUEST_TIMEOUT_MS,
    requestsPerMinute: env.SIGMA_REQUESTS_PER_MINUTE,
    maxConcurrency: env.SIGMA_MAX_CONCURRENCY,
    userAgent: env.SIGMA_USER_AGENT,
    dryRun,
  });
}

async function createBootstrapImporter(
  env: Env,
): Promise<import('@buildsense/scraping-core').SigmaBootstrapImporter> {
  const { SigmaBootstrapImporter, SnapshotStore } = await import('@buildsense/scraping-core');
  const adapter = new SigmaScraperAdapter(env.SIGMA_BASE_URL);
  const snapshotBaseDir = path.resolve(env.SCRAPER_SNAPSHOT_DIR);
  const snapshotStore = new SnapshotStore(snapshotBaseDir);
  const runRepository = new ScrapeRunRepository();
  const itemRepository = new ScrapeRunItemRepository();
  const snapshotRepository = new RawProductSnapshotRepository();
  const discoveredProductRepository = new DiscoveredProductRepository();
  const workerLock = new WorkerLock();

  return new SigmaBootstrapImporter({
    adapter,
    snapshotStore,
    runRepository,
    itemRepository,
    snapshotRepository,
    discoveredProductRepository,
    workerLock,
    baseUrl: env.SIGMA_BASE_URL,
    manifestBaseDir: path.resolve(env.SCRAPER_SNAPSHOT_DIR, '..', 'bootstrap-imports'),
    snapshotBaseDir,
    lockTtlMs: 300000,
    maxRetries: env.SIGMA_MAX_RETRIES,
    requestTimeoutMs: env.SIGMA_REQUEST_TIMEOUT_MS,
    userAgent: env.SIGMA_USER_AGENT,
  });
}

async function runSigmaCommand(
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
      'Sigma command failed',
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

const sigmaFullCommand = new Command('full')
  .description('Run full discovery + fetch across all enabled categories')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .action(async (options: { runId?: string }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'sigma:full',
    });

    await runSigmaCommand(async () => {
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
        'Sigma full run completed',
      );
    }, logger);
  });

const sigmaCategoryCommand = new Command('category')
  .description('Run discovery + fetch for a specific category seed')
  .argument('<seed-id>', 'Category seed ID (e.g., GPU, CPU, RAM)')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .action(async (seedId: string, options: { runId?: string }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'sigma:category',
    });

    await runSigmaCommand(async () => {
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
        'Sigma category run completed',
      );
    }, logger);
  });

const sigmaUrlCommand = new Command('url')
  .description('Fetch and snapshot a single Sigma product URL')
  .argument('<url>', 'Sigma product URL')
  .option('--run-id <id>', 'Resume or create a run with this ID')
  .option('--dry-run', 'Parse without persisting snapshots')
  .action(async (url: string, options: { runId?: string; dryRun?: boolean }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'sigma:url',
    });

    await runSigmaCommand(async () => {
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
        'Sigma URL run completed',
      );
    }, logger);
  });

async function runBootstrapImportAction(options: {
  runId?: string;
  seedId?: string;
}): Promise<void> {
  const env = resolveEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
    service: 'worker',
    command: 'sigma:bootstrap-import',
  });

  await runSigmaCommand(async () => {
    const importer = await createBootstrapImporter(env);
    const result = await importer.execute({
      ...(options.runId !== undefined && { runId: options.runId }),
      ...(options.seedId !== undefined && { seedId: options.seedId }),
    });

    logger.info(
      {
        runId: result.runId,
        bootstrapStatus: result.bootstrapStatus,
        manifestPath: result.manifestPath,
        auditPath: result.auditPath,
        pageExpected: result.manifest.pageTotals.expected,
        pageProcessed: result.manifest.pageTotals.processed,
        uniqueUrls: result.manifest.productUrls.unique,
        successfulFetches: result.manifest.fetch.successful,
        failedFetches: result.manifest.fetch.failed,
        parseFailedSnapshots: result.manifest.snapshots.parseFailed,
        deferredM2Bug: result.manifest.m2Bug001Deferred,
      },
      'Sigma bootstrap import finished',
    );

    if (result.bootstrapStatus === 'INCOMPLETE') {
      process.exitCode = 1;
    }
  }, logger);
}

const sigmaBootstrapImportCommand = new Command('bootstrap-import')
  .description('Run one-time Sigma bootstrap import with upfront pagination generation')
  .option('--run-id <id>', 'Resume or create a bootstrap run with this ID')
  .option('--seed-id <seedId>', 'Optional category seed ID to run a small proof')
  .action(runBootstrapImportAction);

export const sigmaBootstrapImportAliasCommand = new Command('sigma:bootstrap-import')
  .description('Alias for sigma bootstrap-import')
  .option('--run-id <id>', 'Resume or create a bootstrap run with this ID')
  .option('--seed-id <seedId>', 'Optional category seed ID to run a small proof')
  .action(runBootstrapImportAction);

const sigmaLiveSampleCommand = new Command('live-sample')
  .description('Fetch and parse a live Sigma product page (no persistence)')
  .option('--url <url>', 'Sigma product URL to fetch')
  .action(async (options: { url?: string }) => {
    const env = resolveEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'sigma:live-sample',
    });

    await runSigmaCommand(async () => {
      const adapter = new SigmaScraperAdapter(env.SIGMA_BASE_URL);
      const url =
        options.url ??
        'https://www.sigma-computer.com/en/product/6660-gigabyte-geforce-rtx-4070-super-windforce-oc-12g';

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
          sku: result.raw.skuText,
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

export const sigmaCommand = new Command('sigma')
  .description('Sigma store scraper commands')
  .addCommand(sigmaFullCommand)
  .addCommand(sigmaCategoryCommand)
  .addCommand(sigmaUrlCommand)
  .addCommand(sigmaBootstrapImportCommand)
  .addCommand(sigmaLiveSampleCommand);
