import { validateEnv } from '@buildsense/config';
import {
  connectDatabase,
  disconnectDatabase,
  AdminJobModel,
  type AdminJobDocument,
} from '@buildsense/database';
import { createLogger } from '@buildsense/observability';
import { Command } from 'commander';

// ---------------------------------------------------------------------------
// Job execution result
// ---------------------------------------------------------------------------

interface JobExecutionResult {
  success: boolean;
  result?: Record<string, unknown>;
  errorSummary?: string;
}

// ---------------------------------------------------------------------------
// Job processors (safe failures for unsupported operations)
// ---------------------------------------------------------------------------

async function processReprocessCatalog(
  _job: AdminJobDocument,
): Promise<JobExecutionResult> {
  // Full catalog reprocessing requires scraping infrastructure (sigma-adapter, scraping-core)
  // which is not yet wired into a worker polling loop. Fail explicitly so the admin
  // sees the job attempted but the operation is not yet supported.
  return {
    success: false,
    errorSummary:
      'REPROCESS_CATALOG is not yet supported in the worker polling loop. ' +
      'Use the sigma scrape command directly or implement the worker integration.',
  };
}

async function processBackfillFacts(
  _job: AdminJobDocument,
): Promise<JobExecutionResult> {
  // Fact backfill requires compatibility extract infrastructure.
  return {
    success: false,
    errorSummary:
      'BACKFILL_FACTS is not yet supported in the worker polling loop. ' +
      'Use the compatibility extract command directly or implement the worker integration.',
  };
}

async function processReprocessCategory(
  job: AdminJobDocument,
): Promise<JobExecutionResult> {
  const category = (job.params as Record<string, unknown>).category;
  if (!category || typeof category !== 'string') {
    return {
      success: false,
      errorSummary: 'REPROCESS_CATEGORY requires a "category" parameter.',
    };
  }
  // Category reprocessing also requires scraping infrastructure.
  return {
    success: false,
    errorSummary:
      `REPROCESS_CATEGORY for "${category}" is not yet supported in the worker polling loop. ` +
      'Use the sigma scrape command directly or implement the worker integration.',
  };
}

// ---------------------------------------------------------------------------
// Job dispatch
// ---------------------------------------------------------------------------

async function executeJob(job: AdminJobDocument): Promise<JobExecutionResult> {
  switch (job.jobType) {
    case 'REPROCESS_CATALOG':
      return processReprocessCatalog(job);
    case 'BACKFILL_FACTS':
      return processBackfillFacts(job);
    case 'REPROCESS_CATEGORY':
      return processReprocessCategory(job);
    default:
      return {
        success: false,
        errorSummary: `Unknown job type: ${job.jobType}`,
      };
  }
}

// ---------------------------------------------------------------------------
// Claim and process a single job
// ---------------------------------------------------------------------------

async function claimAndProcessJob(
  workerId: string,
  logger: ReturnType<typeof createLogger>,
): Promise<boolean> {
  // Atomically claim a PENDING job — only one worker should get it
  const job = await AdminJobModel.findOneAndUpdate(
    { status: 'PENDING' },
    {
      $set: {
        status: 'CLAIMED',
        claimedBy: workerId,
        claimedAt: new Date(),
      },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, new: true },
  );

  if (!job) {
    return false; // No pending jobs
  }

  const jobId = String(job._id);
  logger.info({ jobId, jobType: job.jobType }, 'Claimed job');

  try {
    // Transition to RUNNING
    await AdminJobModel.findByIdAndUpdate(job._id, { $set: { status: 'RUNNING' } });

    const result = await executeJob(job);

    if (result.success) {
      await AdminJobModel.findByIdAndUpdate(job._id, {
        $set: {
          status: 'SUCCEEDED',
          completedAt: new Date(),
          result: result.result ?? null,
        },
      });
      logger.info({ jobId, jobType: job.jobType }, 'Job completed successfully');
    } else {
      // Check if we've exhausted max attempts
      const currentJob = await AdminJobModel.findById(job._id);
      const maxAttemptsReached = currentJob && currentJob.attempts >= currentJob.maxAttempts;

      if (maxAttemptsReached) {
        await AdminJobModel.findByIdAndUpdate(job._id, {
          $set: {
            status: 'FAILED',
            completedAt: new Date(),
            errorSummary: result.errorSummary ?? 'Unknown error',
          },
        });
        logger.warn(
          { jobId, jobType: job.jobType, attempts: currentJob?.attempts },
          'Job failed after max attempts',
        );
      } else {
        await AdminJobModel.findByIdAndUpdate(job._id, {
          $set: {
            status: 'PENDING',
            completedAt: null,
            errorSummary: result.errorSummary ?? 'Unknown error',
          },
          $unset: { claimedBy: 1, claimedAt: 1 },
        });
        logger.warn(
          { jobId, jobType: job.jobType, attempts: currentJob?.attempts },
          'Job failed, re-queuing for retry',
        );
      }
    }
  } catch (error) {
    // Unexpected error — mark as failed
    const errorSummary =
      error instanceof Error ? error.message : 'Unexpected error during execution';

    await AdminJobModel.findByIdAndUpdate(job._id, {
      $set: {
        status: 'FAILED',
        completedAt: new Date(),
        errorSummary,
      },
    });

    logger.error(
      { jobId, jobType: job.jobType, errorName: error instanceof Error ? error.name : 'UnknownError' },
      'Job execution failed unexpectedly',
    );
  }

  return true; // A job was processed
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

async function pollOnce(
  workerId: string,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const processed = await claimAndProcessJob(workerId, logger);
  if (!processed) {
    logger.debug('No pending jobs found');
  }
}

async function pollLoop(
  workerId: string,
  intervalMs: number,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  logger.info({ intervalMs }, 'Starting admin job poll loop');

  while (true) {
    try {
      await pollOnce(workerId, logger);
    } catch (error) {
      logger.error(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'Poll iteration failed',
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

async function adminJobsAction(options: {
  once?: boolean;
  poll?: boolean;
  interval?: string;
  workerId?: string;
}): Promise<void> {
  const env = validateEnv();
  const workerId = options.workerId ?? `worker-${process.pid}`;
  const intervalMs = parseInt(options.interval ?? '30000', 10);

  const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
    service: 'worker',
    command: 'admin-jobs',
    workerId,
  });

  let failed = false;

  try {
    await connectDatabase(env.MONGO_URI, env.MONGO_DB_NAME);
    logger.info('Connected to MongoDB');

    if (options.once) {
      await pollOnce(workerId, logger);
    } else if (options.poll) {
      await pollLoop(workerId, intervalMs, logger);
    } else {
      // Default: poll once
      await pollOnce(workerId, logger);
    }
  } catch (error) {
    failed = true;
    logger.error(
      {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      'Admin jobs command failed',
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

export const adminJobsCommand = new Command('admin-jobs')
  .description('Poll for and process admin reprocessing/backfill jobs')
  .option('--once', 'Process one job and exit (default)')
  .option('--poll', 'Continuously poll for jobs')
  .option('--interval <ms>', 'Poll interval in milliseconds (default: 30000)', '30000')
  .option('--worker-id <id>', 'Worker identity for job claiming')
  .action(adminJobsAction);
