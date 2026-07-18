import type { Request, Response, NextFunction } from 'express';
import type { ApiErrorResponse } from '@buildsense/contracts';
import { AdminReadService } from './admin-read.service.js';

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePagination(req: Request): { page: number; pageSize: number } | { error: string } {
  let page = 1;
  let pageSize = DEFAULT_PAGE_SIZE;

  if (req.query.page) {
    page = parseInt(req.query.page as string, 10);
    if (isNaN(page) || page < 1) {
      return { error: 'Invalid page parameter' };
    }
  }

  if (req.query.pageSize) {
    pageSize = parseInt(req.query.pageSize as string, 10);
    if (isNaN(pageSize) || pageSize < 1) {
      return { error: 'Invalid pageSize parameter' };
    }
    if (pageSize > MAX_PAGE_SIZE) {
      pageSize = MAX_PAGE_SIZE;
    }
  }

  return { page, pageSize };
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class AdminReadController {
  constructor(private readonly service: AdminReadService) {}

  getDashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dashboard = await this.service.getDashboard();
      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  };

  getScrapeRuns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pagination = parsePagination(req);
      if ('error' in pagination) {
        res.status(400).json(this.errorResponse(pagination.error, req));
        return;
      }

      const result = await this.service.getScrapeRuns(pagination.page, pagination.pageSize);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getScrapeRunDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      if (!id || id.length !== 24) {
        res.status(400).json(this.errorResponse('Invalid ID format', req));
        return;
      }

      const detail = await this.service.getScrapeRunDetail(id);
      if (!detail) {
        res.status(404).json(this.errorResponse('Scrape run not found', req));
        return;
      }

      res.json(detail);
    } catch (error) {
      next(error);
    }
  };

  getCompatibilityQuality = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const quality = await this.service.getCompatibilityQuality();
      res.json(quality);
    } catch (error) {
      next(error);
    }
  };

  getWorkerStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.service.getWorkerStatus();
      res.json(status);
    } catch (error) {
      next(error);
    }
  };

  getCatalogStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.service.getCatalogStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };

  // -- Helpers ---------------------------------------------------------------

  private errorResponse(error: string, req: Request): ApiErrorResponse {
    return { error, requestId: String(req.headers['x-request-id'] ?? '') };
  }
}
