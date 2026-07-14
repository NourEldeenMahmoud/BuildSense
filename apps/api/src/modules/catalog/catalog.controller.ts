import type { Request, Response, NextFunction } from 'express';
import { CatalogService, type GetProductsParams } from './catalog.service.js';

export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  getCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.catalogService.getCategories();
      res.json({ items: categories });
    } catch (error) {
      next(error);
    }
  };

  getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Parse and validate pagination
      let page = 1;
      let pageSize = 24;

      if (req.query.page) {
        page = parseInt(req.query.page as string, 10);
        if (isNaN(page) || page < 1) {
          res.status(400).json({ error: 'Invalid page parameter' });
          return;
        }
      }

      if (req.query.pageSize) {
        pageSize = parseInt(req.query.pageSize as string, 10);
        if (isNaN(pageSize) || pageSize < 1) {
          res.status(400).json({ error: 'Invalid pageSize parameter' });
          return;
        }
        if (pageSize > 100) {
          pageSize = 100;
        }
      }

      // Parse search, category, brand
      const search = req.query.search as string | undefined;
      const category = req.query.category as string | undefined;
      const brand = req.query.brand as string | undefined;

      // Parse minPrice, maxPrice
      let minPrice: number | undefined;
      if (req.query.minPrice !== undefined) {
        minPrice = parseFloat(req.query.minPrice as string);
        if (isNaN(minPrice)) {
          res.status(400).json({ error: 'Invalid minPrice parameter' });
          return;
        }
      }

      let maxPrice: number | undefined;
      if (req.query.maxPrice !== undefined) {
        maxPrice = parseFloat(req.query.maxPrice as string);
        if (isNaN(maxPrice)) {
          res.status(400).json({ error: 'Invalid maxPrice parameter' });
          return;
        }
      }

      // Parse sort
      let sort: 'price_asc' | 'price_desc' | 'newest' | undefined;
      if (req.query.sort) {
        const sortStr = req.query.sort as string;
        if (sortStr !== 'price_asc' && sortStr !== 'price_desc' && sortStr !== 'newest') {
          res.status(400).json({ error: 'Invalid sort parameter' });
          return;
        }
        sort = sortStr;
      }

      const params: GetProductsParams = {
        page,
        pageSize,
      };

      if (search !== undefined) params.search = search;
      if (category !== undefined) params.category = category;
      if (brand !== undefined) params.brand = brand;
      if (minPrice !== undefined) params.minPrice = minPrice;
      if (maxPrice !== undefined) params.maxPrice = maxPrice;
      if (sort !== undefined) params.sort = sort;

      const result = await this.catalogService.getProducts(params);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      if (!id || id.length !== 24) {
        res.status(400).json({ error: 'Invalid ObjectId format' });
        return;
      }

      const product = await this.catalogService.getProductById(id);
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      res.json(product);
    } catch (error) {
      next(error);
    }
  };

  getProductOffers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      if (!id || id.length !== 24) {
        res.status(400).json({ error: 'Invalid ObjectId format' });
        return;
      }

      const offers = (await this.catalogService.getProductOffers(id)) as unknown[];
      if (!offers || offers.length === 0) {
        // We could return empty array or 404 depending on if product exists,
        // but if product is valid ObjectId and no offers, return empty array.
        // If product doesn't exist at all, we should theoretically return 404.
        // Let's check product existence first to be safe and accurate with 404.
        const product = await this.catalogService.getProductById(id);
        if (!product) {
           res.status(404).json({ error: 'Product not found' });
           return;
        }
        res.json({ items: [] });
        return;
      }

      res.json({ items: offers });
    } catch (error) {
      next(error);
    }
  };
}
