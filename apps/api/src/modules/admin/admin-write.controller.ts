import type { Request, Response, NextFunction } from 'express';
import type { ApiErrorResponse } from '@buildsense/contracts';
import { AdminWriteService, AdminWriteError } from './admin-write.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorResponse(error: string, req: Request): ApiErrorResponse {
  return { error, requestId: String(req.headers['x-request-id'] ?? '') };
}

function getRequestId(req: Request): string | undefined {
  const id = req.headers['x-request-id'];
  return typeof id === 'string' && id ? id : undefined;
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.admin) {
    res.status(401).json(errorResponse('Unauthorized', req));
    return false;
  }
  return true;
}

function sendError(res: Response, req: Request, error: unknown): void {
  if (error instanceof AdminWriteError) {
    res.status(error.statusCode).json(errorResponse(error.message, req));
    return;
  }
  res.status(500).json(errorResponse('Internal Server Error', req));
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class AdminWriteController {
  constructor(private readonly service: AdminWriteService) {}

  // -- Match Reviews ---------------------------------------------------------

  getMatchReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, pageSize, status } = req.query;
      const result = await this.service.getMatchReviews(
        page as string | undefined,
        pageSize as string | undefined,
        status as string | undefined,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getMatchReviewDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const detail = await this.service.getMatchReviewDetail(String(req.params.id));
      if (!detail) {
        res.status(404).json(errorResponse('Match review not found', req));
        return;
      }
      res.json(detail);
    } catch (error) {
      next(error);
    }
  };

  linkMatchReview = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      if (!requireAdmin(req, res)) return;
      await this.service.linkMatchReview(
        String(req.params.id),
        req.body,
        req.admin!._id,
        getRequestId(req),
      );
      res.json({ ok: true });
    } catch (error) {
      sendError(res, req, error);
    }
  };

  ignoreMatchReview = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      if (!requireAdmin(req, res)) return;
      await this.service.ignoreMatchReview(
        String(req.params.id),
        req.body,
        req.admin!._id,
        getRequestId(req),
      );
      res.json({ ok: true });
    } catch (error) {
      sendError(res, req, error);
    }
  };

  createProductFromMatchReview = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      if (!requireAdmin(req, res)) return;
      const productId = await this.service.createProductFromMatchReview(
        String(req.params.id),
        req.body,
        req.admin!._id,
        getRequestId(req),
      );
      res.json({ ok: true, productId });
    } catch (error) {
      sendError(res, req, error);
    }
  };

  // -- Data Quality Issues ---------------------------------------------------

  getDataQualityIssues = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, pageSize, status, category } = req.query;
      const result = await this.service.getDataQualityIssues(
        page as string | undefined,
        pageSize as string | undefined,
        status as string | undefined,
        category as string | undefined,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getDataQualityIssueDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const detail = await this.service.getDataQualityIssueDetail(String(req.params.id));
      if (!detail) {
        res.status(404).json(errorResponse('Data quality issue not found', req));
        return;
      }
      res.json(detail);
    } catch (error) {
      next(error);
    }
  };

  resolveDataQualityIssue = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      if (!requireAdmin(req, res)) return;
      await this.service.resolveDataQualityIssue(
        String(req.params.id),
        req.body,
        req.admin!._id,
        getRequestId(req),
      );
      res.json({ ok: true });
    } catch (error) {
      sendError(res, req, error);
    }
  };

  // -- Eligibility Overrides -------------------------------------------------

  getEligibilityOverrides = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, pageSize } = req.query;
      const result = await this.service.getEligibilityOverrides(
        page as string | undefined,
        pageSize as string | undefined,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getEligibilityOverrideDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const detail = await this.service.getEligibilityOverrideDetail(String(req.params.id));
      if (!detail) {
        res.status(404).json(errorResponse('Eligibility override not found', req));
        return;
      }
      res.json(detail);
    } catch (error) {
      next(error);
    }
  };

  overrideEligibility = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      if (!requireAdmin(req, res)) return;
      const result = await this.service.overrideEligibility(
        String(req.params.id),
        req.body,
        req.admin!._id,
        getRequestId(req),
      );
      res.json(result);
    } catch (error) {
      sendError(res, req, error);
    }
  };

  // -- Admin Jobs (Reprocessing / Backfill) ----------------------------------

  getJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, pageSize, status } = req.query;
      const result = await this.service.getJobs(
        page as string | undefined,
        pageSize as string | undefined,
        status as string | undefined,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getJobDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const detail = await this.service.getJobDetail(String(req.params.id));
      if (!detail) {
        res.status(404).json(errorResponse('Job not found', req));
        return;
      }
      res.json(detail);
    } catch (error) {
      next(error);
    }
  };

  requestReprocessJob = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      if (!requireAdmin(req, res)) return;
      const jobId = await this.service.requestReprocessJob(
        req.body,
        req.admin!._id,
        getRequestId(req),
      );
      res.json({ ok: true, jobId });
    } catch (error) {
      sendError(res, req, error);
    }
  };
}
