import express from 'express';
import { AdminReadController } from './admin-read.controller.js';
import { AdminReadService } from './admin-read.service.js';
import { requireAdminSession } from '../../middleware/admin-auth.js';

export function createAdminReadRoutes(): express.Router {
  const router = express.Router();
  const service = new AdminReadService();
  const controller = new AdminReadController(service);

  // All admin read routes require a valid session (read-only GET — no CSRF needed)
  router.use(requireAdminSession());

  // Dashboard summary
  router.get('/dashboard', controller.getDashboard);

  // Scrape runs
  router.get('/scrape-runs', controller.getScrapeRuns);
  router.get('/scrape-runs/:id', controller.getScrapeRunDetail);

  // Compatibility quality reports
  router.get('/compatibility-quality', controller.getCompatibilityQuality);

  // Worker status (active locks)
  router.get('/worker-status', controller.getWorkerStatus);

  // Catalog/operational stats
  router.get('/catalog-stats', controller.getCatalogStats);

  return router;
}
