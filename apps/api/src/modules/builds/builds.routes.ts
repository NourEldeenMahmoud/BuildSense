import express from 'express';
import { BuildsController } from './builds.controller.js';
import { BuildService } from './builds.service.js';

export function createBuildsRoutes(): express.Router {
  const router = express.Router();
  const service = new BuildService();
  const controller = new BuildsController(service);

  // -- CRUD ------------------------------------------------------------------

  /** Create a new build. */
  router.post('/', controller.createBuild);

  /** Get a build by public ID. */
  router.get('/:publicId', controller.getBuild);

  /** Update a build's name (optimistic concurrency). */
  router.patch('/:publicId', controller.updateBuild);

  // -- Items -----------------------------------------------------------------

  /** Add or replace an item in a build slot (optimistic concurrency). */
  router.put('/:publicId/items/:slot', controller.putItem);

  /** Remove an item from a build slot (optimistic concurrency). */
  router.delete('/:publicId/items/:slot', controller.deleteItem);

  // -- Derived ---------------------------------------------------------------

  /** Trigger a full compatibility evaluation and return the updated build. */
  router.post('/:publicId/validate', controller.validateBuild);

  /** List candidate products for a slot with compatibility grouping. */
  router.get('/:publicId/candidates/:slot', controller.getCandidates);

  /** Generate a purchase plan for all items in the build. */
  router.get('/:publicId/purchase-plan', controller.getPurchasePlan);

  return router;
}
