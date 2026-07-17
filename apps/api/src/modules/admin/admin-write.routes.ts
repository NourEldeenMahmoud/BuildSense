import express from 'express';
import { AdminWriteController } from './admin-write.controller.js';
import { AdminWriteService } from './admin-write.service.js';
import {
  requireAdminSession,
  requireCsrfToken,
  requireOrigin,
} from '../../middleware/admin-auth.js';

export function createAdminWriteRoutes(webOrigin: string): express.Router {
  const router = express.Router();
  const service = new AdminWriteService();
  const controller = new AdminWriteController(service);

  // All write routes require a valid session
  router.use(requireAdminSession());

  // -- Match Reviews ---------------------------------------------------------

  // Read-only GET routes
  router.get('/match-reviews', controller.getMatchReviews);
  router.get('/match-reviews/:id', controller.getMatchReviewDetail);

  // Mutating POST routes — require CSRF + Origin
  router.post(
    '/match-reviews/:id/link',
    requireCsrfToken(),
    requireOrigin(webOrigin),
    controller.linkMatchReview,
  );
  router.post(
    '/match-reviews/:id/ignore',
    requireCsrfToken(),
    requireOrigin(webOrigin),
    controller.ignoreMatchReview,
  );
  router.post(
    '/match-reviews/:id/create-product',
    requireCsrfToken(),
    requireOrigin(webOrigin),
    controller.createProductFromMatchReview,
  );

  // -- Data Quality Issues ---------------------------------------------------

  // Read-only GET routes
  router.get('/data-quality-issues', controller.getDataQualityIssues);
  router.get('/data-quality-issues/:id', controller.getDataQualityIssueDetail);

  // Mutating POST routes — require CSRF + Origin
  router.post(
    '/data-quality-issues/:id/resolve',
    requireCsrfToken(),
    requireOrigin(webOrigin),
    controller.resolveDataQualityIssue,
  );

  // -- Eligibility Overrides -------------------------------------------------

  // Read-only GET routes
  router.get('/eligibility-overrides', controller.getEligibilityOverrides);
  router.get('/eligibility-overrides/:id', controller.getEligibilityOverrideDetail);

  // Mutating POST routes — require CSRF + Origin
  router.post(
    '/eligibility/:id/override',
    requireCsrfToken(),
    requireOrigin(webOrigin),
    controller.overrideEligibility,
  );

  // -- Admin Jobs (Reprocessing / Backfill) ----------------------------------

  // Read-only GET routes
  router.get('/jobs', controller.getJobs);
  router.get('/jobs/:id', controller.getJobDetail);

  // Mutating POST routes — require CSRF + Origin
  router.post(
    '/jobs/reprocess',
    requireCsrfToken(),
    requireOrigin(webOrigin),
    controller.requestReprocessJob,
  );

  return router;
}
