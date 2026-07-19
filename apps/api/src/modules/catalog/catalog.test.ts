import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CatalogProductModel, OfferModel } from '@buildsense/database';
import { createLogger } from '@buildsense/observability';

import express from 'express';

let mongoServer: MongoMemoryServer;
let app: express.Express;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  
  app = createApp({
    isDatabaseConnected: () => true,
    logger: createLogger({ level: 'fatal', name: 'test' }),
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await CatalogProductModel.deleteMany({});
  await OfferModel.deleteMany({});
});

describe('Catalog API', () => {
  describe('GET /api/v1/categories', () => {
    it('returns alphabetically sorted categories excluding nulls', async () => {
      await CatalogProductModel.create([
        { title: 'A', category: 'GPU' },
        { title: 'B', category: 'CPU' },
        { title: 'C', category: 'RAM' },
        { title: 'D', category: 'CPU' },
      ]);
      
      const res = await request(app).get('/api/v1/categories');
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual(['CPU', 'GPU', 'RAM']);
    });
  });

  describe('GET /api/v1/products', () => {
    beforeEach(async () => {
      const p1 = await CatalogProductModel.create({
        title: 'AMD Ryzen 5 7600',
        category: 'CPU',
        brand: 'AMD',
      });
      await OfferModel.create({
        catalogProductId: p1._id,
        storeCode: 'SIGMA',
        storeExternalId: '1',
        sourceUrl: 'url1',
        price: 5000,
        availability: 'IN_STOCK',
      });

      const p2 = await CatalogProductModel.create({
        title: 'Intel Core i5',
        category: 'CPU',
        brand: 'Intel',
      });
      await OfferModel.create({
        catalogProductId: p2._id,
        storeCode: 'SIGMA',
        storeExternalId: '2',
        sourceUrl: 'url2',
        price: 6000,
        availability: 'IN_STOCK',
      });

      const p3 = await CatalogProductModel.create({
        title: 'NVIDIA RTX 4060',
        category: 'GPU',
        brand: 'NVIDIA',
      });
      await OfferModel.create({
        catalogProductId: p3._id,
        storeCode: 'SIGMA',
        storeExternalId: '3',
        sourceUrl: 'url3',
        price: null, 
      });
    });

    it('returns paginated products with default page/pageSize', async () => {
      const res = await request(app).get('/api/v1/products');
      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.pageSize).toBe(24);
      expect(res.body.pagination.totalItems).toBe(3);
      expect(res.body.items).toHaveLength(3);
    });

    it('validates invalid pageSize', async () => {
      const res = await request(app).get('/api/v1/products?pageSize=abc');
      expect(res.status).toBe(400);
    });
    
    it('caps pageSize to 100', async () => {
      const res = await request(app).get('/api/v1/products?pageSize=200');
      expect(res.status).toBe(200);
      expect(res.body.pagination.pageSize).toBe(100);
    });

    it('filters by category and brand', async () => {
      const res = await request(app).get('/api/v1/products?category=CPU&brand=AMD');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('AMD Ryzen 5 7600');
    });

    it('searches across title', async () => {
      const res = await request(app).get('/api/v1/products?search=ryzen');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('AMD Ryzen 5 7600');
    });

    it('filters by minPrice and maxPrice (ignoring null prices)', async () => {
      const res = await request(app).get('/api/v1/products?maxPrice=5500');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].price).toBe(5000);
    });

    it('sorts by price_asc (nulls last)', async () => {
      const res = await request(app).get('/api/v1/products?sort=price_asc');
      expect(res.body.items[0].price).toBe(5000);
      expect(res.body.items[1].price).toBe(6000);
      expect(res.body.items[2].price).toBeNull();
    });
  });

  describe('GET /api/v1/products/:id', () => {
    it('returns 400 for invalid ObjectId', async () => {
      const res = await request(app).get('/api/v1/products/123');
      expect(res.status).toBe(400);
    });

    it('returns 404 for missing product', async () => {
      const res = await request(app).get(`/api/v1/products/${new mongoose.Types.ObjectId()}`);
      expect(res.status).toBe(404);
    });

    it('returns product details with offers', async () => {
      const p = await CatalogProductModel.create({
        title: 'Product 1',
        category: 'Test',
      });
      await OfferModel.create({
        catalogProductId: p._id,
        storeCode: 'SIGMA',
        storeExternalId: 'ext',
        sourceUrl: 'url',
        price: 100
      });

      const res = await request(app).get(`/api/v1/products/${p._id}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Product 1');
      expect(res.body.offers).toHaveLength(1);
      expect(res.body.offers[0].price).toBe(100);
    });
  });

  describe('GET /api/v1/products/:id/offers', () => {
    it('returns offers for a valid product', async () => {
      const p = await CatalogProductModel.create({
        title: 'Product 1',
        category: 'Test',
      });
      await OfferModel.create({
        catalogProductId: p._id,
        storeCode: 'SIGMA',
        storeExternalId: 'ext',
        sourceUrl: 'url',
        price: 100
      });

      const res = await request(app).get(`/api/v1/products/${p._id}/offers`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });
  });
});
