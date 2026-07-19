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
import { ElNourScraperAdapter } from '@buildsense/el-nour-adapter';
import { createLogger } from '@buildsense/observability';
import { Command } from 'commander';
import * as path from 'node:path';

type Env = ReturnType<typeof validateEnv> & ReturnType<typeof parseWorkerEnv>;

async function createOrchestrator(
  env: Env,
  dryRun: boolean,
): Promise<import('@buildsense/scraping-core').Orchestrator> {
  const { Orchestrator, SnapshotStore } = await import('@buildsense/scraping-core');
  const adapter = new ElNourScraperAdapter(env.EL_NOUR_BASE_URL);
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
    baseUrl: env.EL_NOUR_BASE_URL,
    lockTtlMs: 300000,
    maxPagesPerCategory: env.EL_NOUR_MAX_PAGES_PER_CATEGORY,
    maxRetries: env.EL_NOUR_MAX_RETRIES,
    requestTimeoutMs: env.EL_NOUR_REQUEST_TIMEOUT_MS,
    requestsPerMinute: env.EL_NOUR_REQUESTS_PER_MINUTE,
    maxConcurrency: env.EL_NOUR_MAX_CONCURRENCY,
    userAgent: env.EL_NOUR_USER_AGENT,
    dryRun,
  });
}

async function runElNourCommand(
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
      'El Nour command failed',
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

// ---------------------------------------------------------------------------
// Shared action handlers (reused by both el-nour and el-nour-tech alias)
// ---------------------------------------------------------------------------

async function fullAction(options: { runId?: string }): Promise<void> {
  const env = resolveEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
    service: 'worker',
    command: 'el-nour:full',
  });

  await runElNourCommand(async () => {
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
      'El Nour full run completed',
    );
  }, logger);
}

async function categoryAction(seedId: string, options: { runId?: string }): Promise<void> {
  const env = resolveEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
    service: 'worker',
    command: 'el-nour:category',
  });

  await runElNourCommand(async () => {
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
      'El Nour category run completed',
    );
  }, logger);
}

async function urlAction(
  url: string,
  options: { runId?: string; dryRun?: boolean },
): Promise<void> {
  const env = resolveEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
    service: 'worker',
    command: 'el-nour:url',
  });

  await runElNourCommand(async () => {
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
      'El Nour URL run completed',
    );
  }, logger);
}

async function liveSampleAction(options: { url?: string }): Promise<void> {
  const env = resolveEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
    service: 'worker',
    command: 'el-nour:live-sample',
  });

  await runElNourCommand(async () => {
    const adapter = new ElNourScraperAdapter(env.EL_NOUR_BASE_URL);
    const url =
      options.url ??
      'https://elnour-tech.com/en/product/amd-ryzen-5-3400g-4-core-am4-3-7ghz/';

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
}

async function importCapturesAction(
  manifestPath: string,
  options: { publish?: boolean },
): Promise<void> {
  const env = resolveEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
    service: 'worker',
    command: 'el-nour:import-captures',
  });

  await runElNourCommand(async () => {
    const { SnapshotStore } = await import('@buildsense/scraping-core');
    const { executeBrowserCaptureImport } = await import('../services/browser-capture-import.js');
    const adapter = new ElNourScraperAdapter(env.EL_NOUR_BASE_URL);
    const snapshotBaseDir = path.resolve(env.SCRAPER_SNAPSHOT_DIR);
    const snapshotStore = new SnapshotStore(snapshotBaseDir);

    const result = await executeBrowserCaptureImport(
      {
        storeCode: 'EL_NOUR',
        storeHost: new URL(env.EL_NOUR_BASE_URL).hostname,
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
      'El Nour browser-capture import completed',
    );
  }, logger);
}

// ---------------------------------------------------------------------------
// Command tree builder (shared by el-nour and el-nour-tech alias)
// ---------------------------------------------------------------------------

function buildElNourSubcommands(): Command[] {
  return [
    new Command('full')
      .description('Run full discovery + fetch across all enabled categories')
      .option('--run-id <id>', 'Resume or create a run with this ID')
      .action(fullAction),

    new Command('category')
      .description('Run discovery + fetch for a specific category seed')
      .argument('<seed-id>', 'Category seed ID (e.g., CPU, GPU, MOTHERBOARD)')
      .option('--run-id <id>', 'Resume or create a run with this ID')
      .action(categoryAction),

    new Command('url')
      .description('Fetch and snapshot a single El Nour product URL')
      .argument('<url>', 'El Nour product URL')
      .option('--run-id <id>', 'Resume or create a run with this ID')
      .option('--dry-run', 'Parse without persisting snapshots')
      .action(urlAction),

    new Command('live-sample')
      .description('Fetch and parse a live El Nour product page (no persistence)')
      .option('--url <url>', 'El Nour product URL to fetch')
      .action(liveSampleAction),

    new Command('import-captures')
      .description('Import browser-captured HTML files from a manifest (no network)')
      .argument('<manifest-path>', 'Path to the browser-capture manifest JSON')
      .option('--publish', 'After snapshot, attempt to publish into catalog + offers')
      .action(importCapturesAction),
  ];
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const elNourCommand = new Command('el-nour')
  .description('El Nour Tech store scraper commands');
for (const cmd of buildElNourSubcommands()) elNourCommand.addCommand(cmd);

export const elNourTechAliasCommand = new Command('el-nour-tech')
  .description('Alias for el-nour — El Nour Tech store scraper commands');
for (const cmd of buildElNourSubcommands()) elNourTechAliasCommand.addCommand(cmd);
