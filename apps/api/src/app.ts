import type { ApiErrorResponse } from '@buildsense/contracts';
import { isDatabaseConnected } from '@buildsense/database';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { randomUUID } from 'node:crypto';
import { createLogger } from '@buildsense/observability';
import { createHealthRoutes } from './modules/health/health.routes.js';

interface ApiAppOptions {
  logger?: ReturnType<typeof createLogger>;
  isDatabaseConnected?: () => boolean;
}

function createErrorResponse(error: string, requestId: string): ApiErrorResponse {
  return { error, requestId };
}

export function createApp(options: ApiAppOptions = {}): express.Express {
  const logger = options.logger ?? createLogger({ name: 'buildsense' }).child({ service: 'api' });
  const databaseConnected = options.isDatabaseConnected ?? isDatabaseConnected;
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use((_req, res, next) => {
    res.setHeader('X-Request-Id', randomUUID());
    next();
  });
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      logger.info(
        {
          durationMs: Date.now() - startedAt,
          method: req.method,
          path: req.path,
          requestId: res.getHeader('X-Request-Id'),
          statusCode: res.statusCode,
        },
        'HTTP request completed',
      );
    });
    next();
  });
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/health', createHealthRoutes(databaseConnected));
  app.get('/api/health', (_req, res) => {
    if (!databaseConnected()) {
      res.status(503).json({ status: 'error', database: 'disconnected' });
      return;
    }

    res.json({ status: 'ok', database: 'connected' });
  });
  app.get('/', (_req, res) => {
    res.json({ name: 'BuildSense API', version: '0.0.0' });
  });
  app.use((_req, res) => {
    const requestId = String(res.getHeader('X-Request-Id'));
    res.status(404).json(createErrorResponse('Not Found', requestId));
  });
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'Unhandled request error',
      );
      const requestId = String(res.getHeader('X-Request-Id'));
      res.status(500).json(createErrorResponse('Internal Server Error', requestId));
    },
  );

  return app;
}
