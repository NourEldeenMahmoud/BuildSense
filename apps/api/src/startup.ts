import { validateEnv } from '@buildsense/config';
import { connectDatabase, disconnectDatabase } from '@buildsense/database';
import { createLogger } from '@buildsense/observability';
import type { Server } from 'node:http';
import { createApp } from './app.js';

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function startApi(): Promise<void> {
  const env = validateEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
    service: 'api',
  });

  logger.info('Connecting to MongoDB');
  await connectDatabase(env.MONGO_URI, env.MONGO_DB_NAME);
  logger.info('MongoDB connected');

  const server = createApp({ logger }).listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT }, 'API server started');
  });

  let isShuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    void (async (): Promise<void> => {
      try {
        logger.info({ signal }, 'API shutdown started');
        await closeServer(server);
        await disconnectDatabase();
        logger.info('API shutdown completed');
      } catch (error) {
        process.exitCode = 1;
        logger.error(
          {
            errorName: error instanceof Error ? error.name : 'UnknownError',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
          'API shutdown failed',
        );
      }
    })();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void startApi().catch((error: unknown) => {
  process.exitCode = 1;
  createLogger({ name: 'buildsense' })
    .child({ service: 'api' })
    .fatal(
      {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
      'API startup failed',
    );
});
