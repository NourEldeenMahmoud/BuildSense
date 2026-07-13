import { validateEnv } from '@buildsense/config';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '@buildsense/database';
import { createLogger } from '@buildsense/observability';
import { Command } from 'commander';

export const healthCommand = new Command('health')
  .description('Check worker health and database connectivity')
  .action(async () => {
    const env = validateEnv();
    const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
      service: 'worker',
    });
    let failed = false;

    try {
      logger.info('Worker health check started');
      await connectDatabase(env.MONGO_URI, env.MONGO_DB_NAME);

      if (!isDatabaseConnected()) {
        throw new Error('MongoDB connection was not established');
      }

      logger.info('Worker health check passed');
    } catch (error) {
      failed = true;
      logger.error(
        {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Worker health check failed',
      );
    } finally {
      try {
        await disconnectDatabase();
        logger.info('MongoDB disconnected');
      } catch (error) {
        failed = true;
        logger.error(
          {
            errorName: error instanceof Error ? error.name : 'UnknownError',
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          'MongoDB disconnect failed',
        );
      }
    }

    if (failed) {
      process.exitCode = 1;
    }
  });
