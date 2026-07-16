import { Command } from 'commander';
import { connectDatabase, disconnectDatabase } from '@buildsense/database';
import { validateEnv } from '@buildsense/config';
import { createLogger } from '@buildsense/observability';
import { runCompatibilityExtract } from './compatibility-extract.js';

// ---------------------------------------------------------------------------
// Commander command — thin CLI layer delegating to orchestration service
// ---------------------------------------------------------------------------

export const compatibilityExtractCommand = new Command('extract')
  .description('Extract compatibility facts from catalog products')
  .option('-c, --category <name>', 'Extract for a single category (CPU, Motherboard, RAM, GPU, Storage, PSU, Case)')
  .option('-a, --all', 'Extract for all supported categories')
  .option('-d, --dry-run', 'Report scope without persisting', false)
  .option('-b, --batch-size <n>', 'Products per batch', '100')
  .option('--resume-from <productId>', 'Resume from this _id (exclusive)')
  .option('--extractor-version <ver>', 'Override extractor version (for testing)')
  .option('-f, --force-reprocess', 'Re-extract even if version matches', false)
  .option('--report-only', 'Report coverage/precision stats only — no extraction', false)
  .option('--migrate-legacy', 'Run legacy normalization before extraction', false)
  .option('--migrate-legacy-dry-run', 'Run legacy normalization dry-run before extraction', false)
  .action(async (options) => {
    const env = validateEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
      command: 'compatibility:extract',
    });

    let failed = false;

    try {
      await connectDatabase(env.MONGO_URI, env.MONGO_DB_NAME);
      logger.info('Connected to MongoDB');

      const result = await runCompatibilityExtract({
        category: options.category,
        all: options.all,
        dryRun: options.dryRun,
        batchSize: parseInt(options.batchSize, 10) || 100,
        resumeFrom: options.resumeFrom,
        extractorVersion: options.extractorVersion,
        forceReprocess: options.forceReprocess,
        reportOnly: options.reportOnly,
        migrateLegacyDryRun: options.migrateLegacyDryRun,
        migrateLegacy: options.migrateLegacy,
      });

      if (result.status === 'error') {
        failed = true;
        logger.error({ error: result.error }, 'Extraction failed');
      } else {
        logger.info(
          {
            status: result.status,
            categories: result.summary.categories,
            totalScanned: result.summary.totalScanned,
            totalExtracted: result.summary.totalExtracted,
            totalUpdated: result.summary.totalUpdated,
            totalSkipped: result.summary.totalSkipped,
            totalFailed: result.summary.totalFailed,
            elapsedMs: result.summary.elapsedMs,
            qualityReports: result.summary.qualityReports.map((r) => ({
              category: r.category,
              allGatesPass: r.allGatesPass,
            })),
          },
          'Compatibility extraction completed',
        );
      }
    } catch (error) {
      failed = true;
      logger.error(
        {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Compatibility extract command failed',
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
  });
