import express from 'express';

export function createHealthRoutes(isDatabaseConnected: () => boolean): express.Router {
  const healthRoutes = express.Router();

  healthRoutes.get('/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  healthRoutes.get('/ready', (_req, res) => {
    if (!isDatabaseConnected()) {
      res.status(503).json({ status: 'not_ready', database: 'disconnected' });
      return;
    }

    res.json({ status: 'ready', database: 'connected' });
  });

  return healthRoutes;
}
