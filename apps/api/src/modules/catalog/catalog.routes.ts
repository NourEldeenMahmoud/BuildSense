import express from 'express';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

export function createCatalogRoutes(): express.Router {
  const router = express.Router();
  const service = new CatalogService();
  const controller = new CatalogController(service);

  /**
   * @swagger
   * /api/v1/categories:
   *   get:
   *     summary: Get all distinct product categories
   *     tags: [Catalog]
   *     responses:
   *       200:
   *         description: A list of categories
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     type: string
   */
  router.get('/categories', controller.getCategories);

  /**
   * @swagger
   * /api/v1/products:
   *   get:
   *     summary: Get a paginated list of products with optional filters
   *     tags: [Catalog]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 24
   *           maximum: 100
   *         description: Number of items per page (max 100)
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search by title, brand, model, or MPN
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by category
   *       - in: query
   *         name: brand
   *         schema:
   *           type: string
   *         description: Filter by brand
   *       - in: query
   *         name: minPrice
   *         schema:
   *           type: number
   *         description: Minimum price filter
   *       - in: query
   *         name: maxPrice
   *         schema:
   *           type: number
   *         description: Maximum price filter
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [price_asc, price_desc, newest]
   *         description: Sort order
   *     responses:
   *       200:
   *         description: A paginated list of products
   *       400:
   *         description: Invalid query parameters
   */
  router.get('/products', controller.getProducts);

  /**
   * @swagger
   * /api/v1/products/{id}:
   *   get:
   *     summary: Get a product by ID
   *     tags: [Catalog]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: MongoDB ObjectId
   *     responses:
   *       200:
   *         description: Product details including offers
   *       400:
   *         description: Invalid ObjectId format
   *       404:
   *         description: Product not found
   */
  router.get('/products/:id', controller.getProductById);

  /**
   * @swagger
   * /api/v1/products/{id}/offers:
   *   get:
   *     summary: Get offers for a specific product
   *     tags: [Catalog]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: MongoDB ObjectId
   *     responses:
   *       200:
   *         description: List of offers
   *       400:
   *         description: Invalid ObjectId format
   *       404:
   *         description: Product not found
   */
  router.get('/products/:id/offers', controller.getProductOffers);

  return router;
}
