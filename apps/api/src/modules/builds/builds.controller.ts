import type { Request, Response, NextFunction } from 'express';
import type { ApiErrorResponse } from '@buildsense/contracts';
import type { BuildDocument } from '@buildsense/database';
import { BuildService } from './builds.service.js';

const VALID_SLOTS = new Set(['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case']);

export class BuildsController {
  constructor(private readonly service: BuildService) {}

  // -- POST /builds ----------------------------------------------------------

  createBuild = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name : '';
      const dto = await this.service.createBuild(name);
      res.status(201).json(dto);
    } catch (error) {
      next(error);
    }
  };

  // -- GET /builds/:publicId -------------------------------------------------

  getBuild = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const publicId = req.params.publicId as string;
      const dto = await this.service.getBuild(publicId);
      if (!dto) {
        res.status(404).json(this.errorResponse('Build not found', req));
        return;
      }
      res.json(dto);
    } catch (error) {
      next(error);
    }
  };

  // -- PATCH /builds/:publicId -----------------------------------------------

  updateBuild = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const publicId = req.params.publicId as string;
      const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
      const expectedVersion = req.body?.expectedVersion;

      if (typeof expectedVersion !== 'number' || expectedVersion < 1 || !Number.isInteger(expectedVersion)) {
        res.status(400).json(this.errorResponse('Invalid expectedVersion', req));
        return;
      }
      if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
        res.status(400).json(this.errorResponse('Invalid name', req));
        return;
      }

      const result = await this.service.updateBuild(publicId, expectedVersion, name ?? '');

      if (result.kind === 'not_found') {
        res.status(404).json(this.errorResponse('Build not found', req));
        return;
      }
      if (result.kind === 'version_conflict') {
        this.sendConflict(res, expectedVersion, result.current, req);
        return;
      }

      const dto = await this.service.getBuild(publicId);
      res.json(dto);
    } catch (error) {
      next(error);
    }
  };

  // -- PUT /builds/:publicId/items/:slot -------------------------------------

  putItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const publicId = req.params.publicId as string;
      const slot = req.params.slot as string;
      const { productId, quantity, expectedVersion } = req.body ?? {};

      // Validate slot
      if (!VALID_SLOTS.has(slot)) {
        res.status(400).json(this.errorResponse('Invalid slot', req));
        return;
      }

      // Validate expectedVersion
      if (typeof expectedVersion !== 'number' || expectedVersion < 1 || !Number.isInteger(expectedVersion)) {
        res.status(400).json(this.errorResponse('Invalid expectedVersion', req));
        return;
      }

      // Validate productId
      if (typeof productId !== 'string' || productId.length === 0) {
        res.status(400).json(this.errorResponse('Invalid productId', req));
        return;
      }

      // Validate quantity
      if (typeof quantity !== 'number' || quantity < 1 || !Number.isInteger(quantity)) {
        res.status(400).json(this.errorResponse('Invalid quantity', req));
        return;
      }

      const result = await this.service.putItem(publicId, expectedVersion, slot, productId, quantity);

      if (result.kind === 'not_found') {
        res.status(404).json(this.errorResponse('Build or product not found', req));
        return;
      }
      if (result.kind === 'version_conflict') {
        this.sendConflict(res, expectedVersion, result.current, req);
        return;
      }

      const dto = await this.service.getBuild(publicId);
      res.json(dto);
    } catch (error) {
      next(error);
    }
  };

  // -- DELETE /builds/:publicId/items/:slot -----------------------------------

  deleteItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const publicId = req.params.publicId as string;
      const slot = req.params.slot as string;
      const expectedVersion = req.body?.expectedVersion;

      if (!VALID_SLOTS.has(slot)) {
        res.status(400).json(this.errorResponse('Invalid slot', req));
        return;
      }
      if (typeof expectedVersion !== 'number' || expectedVersion < 1 || !Number.isInteger(expectedVersion)) {
        res.status(400).json(this.errorResponse('Invalid expectedVersion', req));
        return;
      }

      const result = await this.service.deleteItem(publicId, expectedVersion, slot);

      if (result.kind === 'not_found') {
        res.status(404).json(this.errorResponse('Build not found', req));
        return;
      }
      if (result.kind === 'version_conflict') {
        this.sendConflict(res, expectedVersion, result.current, req);
        return;
      }

      const dto = await this.service.getBuild(publicId);
      res.json(dto);
    } catch (error) {
      next(error);
    }
  };

  // -- POST /builds/:publicId/validate ---------------------------------------

  validateBuild = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const publicId = req.params.publicId as string;
      const dto = await this.service.validateBuild(publicId);
      if (!dto) {
        res.status(404).json(this.errorResponse('Build not found', req));
        return;
      }
      res.json(dto);
    } catch (error) {
      next(error);
    }
  };

  // -- GET /builds/:publicId/candidates/:slot ---------------------------------

  getCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const publicId = req.params.publicId as string;
      const slot = req.params.slot as string;

      if (!VALID_SLOTS.has(slot)) {
        res.status(400).json(this.errorResponse('Invalid slot', req));
        return;
      }

      let page = 1;
      let pageSize = 24;
      if (req.query.page) {
        page = parseInt(req.query.page as string, 10);
        if (isNaN(page) || page < 1) {
          res.status(400).json(this.errorResponse('Invalid page parameter', req));
          return;
        }
      }
      if (req.query.pageSize) {
        pageSize = parseInt(req.query.pageSize as string, 10);
        if (isNaN(pageSize) || pageSize < 1) {
          res.status(400).json(this.errorResponse('Invalid pageSize parameter', req));
          return;
        }
        if (pageSize > 100) pageSize = 100;
      }

      const result = await this.service.getCandidates(publicId, slot, page, pageSize);
      if (!result) {
        res.status(404).json(this.errorResponse('Build not found', req));
        return;
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // -- GET /builds/:publicId/purchase-plan ------------------------------------

  getPurchasePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const publicId = req.params.publicId as string;
      const dto = await this.service.getPurchasePlan(publicId);
      if (!dto) {
        res.status(404).json(this.errorResponse('Build not found', req));
        return;
      }
      res.json(dto);
    } catch (error) {
      next(error);
    }
  };

  // -- Helpers ---------------------------------------------------------------

  private errorResponse(error: string, req: Request): ApiErrorResponse {
    return { error, requestId: String(req.headers['x-request-id'] ?? '') };
  }

  private sendConflict(
    res: Response,
    expectedVersion: number,
    current: BuildDocument,
    req: Request,
  ): void {
    const requestId = String(req.headers['x-request-id'] ?? '');
    const currentVersion = current.version;

    // Re-fetch via service to get a proper DTO
    this.service.getBuild(current.publicId).then((latestBuild) => {
      res.status(409).json({
        error: 'Build version conflict',
        requestId,
        code: 'BUILD_VERSION_CONFLICT',
        details: {
          expectedVersion,
          currentVersion,
          latestBuild,
        },
      });
    }).catch(() => {
      // Fallback: build a minimal DTO from the current document so that
      // latestBuild is always present in the conflict response.
      const fallbackBuild = {
        publicId: current.publicId,
        name: current.name,
        version: current.version,
        items: current.items,
        compatibility: current.compatibility,
        pricing: current.pricing,
        createdAt: current.createdAt.toISOString(),
        updatedAt: current.updatedAt.toISOString(),
      };
      res.status(409).json({
        error: 'Build version conflict',
        requestId,
        code: 'BUILD_VERSION_CONFLICT',
        details: {
          expectedVersion,
          currentVersion,
          latestBuild: fallbackBuild,
        },
      });
    });
  }
}
