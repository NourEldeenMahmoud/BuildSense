import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import { ScrapeRunRepository } from './scrape-run-repository.js';
import { DiscoveredProductRepository } from './discovered-product-repository.js';

describe('DiscoveredProductRepository', () => {
  let runRepository: ScrapeRunRepository;
  let repository: DiscoveredProductRepository;
  let runId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    runRepository = new ScrapeRunRepository();
    repository = new DiscoveredProductRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    const run = await runRepository.create({ storeCode: 'SIGMA', runId: 'test-discovered', mode: 'FULL' });
    runId = run._id;
  });

  it('upserts a new discovered product', async () => {
    const product = await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: 'https://www.sigma-computer.com/en/product/123',
      scrapeRunId: runId,
      externalId: '123',
    });

    expect(product).toBeDefined();
    expect(product.canonicalUrl).toBe('https://www.sigma-computer.com/en/product/123');
    expect(product.externalId).toBe('123');
    expect(product.firstDiscoveredAt).toBeDefined();
    expect(product.lastDiscoveredAt).toBeDefined();
    expect(product.lastScrapeRunId.toString()).toBe(runId.toString());
  });

  it('does not duplicate on repeated upserts', async () => {
    const url = 'https://www.sigma-computer.com/en/product/456';
    await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: url,
      scrapeRunId: runId,
      externalId: '456',
    });
    await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: url,
      scrapeRunId: runId,
      externalId: '456',
    });

    const count = await repository.countByStore('SIGMA');
    expect(count).toBe(1);
  });

  it('updates externalId on subsequent upsert', async () => {
    const url = 'https://www.sigma-computer.com/en/product/789';
    await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: url,
      scrapeRunId: runId,
    });

    const updated = await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: url,
      scrapeRunId: runId,
      externalId: '789',
    });

    expect(updated.externalId).toBe('789');
  });

  it('updates lastDiscoveredAt on subsequent upsert', async () => {
    const url = 'https://www.sigma-computer.com/en/product/101';
    const first = await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: url,
      scrapeRunId: runId,
    });

    const second = await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: url,
      scrapeRunId: runId,
    });

    expect(second.lastDiscoveredAt.getTime()).toBeGreaterThanOrEqual(
      first.lastDiscoveredAt.getTime(),
    );
  });

  it('finds by canonical URL', async () => {
    const url = 'https://www.sigma-computer.com/en/product/202';
    await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: url,
      scrapeRunId: runId,
    });

    const found = await repository.findByCanonicalUrl('SIGMA', url);
    expect(found).toBeDefined();
    expect(found?.canonicalUrl).toBe(url);
  });

  it('returns null for non-existent URL', async () => {
    const found = await repository.findByCanonicalUrl('SIGMA', 'https://nonexistent.com');
    expect(found).toBeNull();
  });

  it('counts products by store', async () => {
    await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: 'https://www.sigma.com/p1',
      scrapeRunId: runId,
    });
    await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: 'https://www.sigma.com/p2',
      scrapeRunId: runId,
    });

    const count = await repository.countByStore('SIGMA');
    expect(count).toBe(2);
  });

  it('deletes all products for a store', async () => {
    await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: 'https://www.sigma.com/p1',
      scrapeRunId: runId,
    });
    await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: 'https://www.sigma.com/p2',
      scrapeRunId: runId,
    });

    const deleted = await repository.deleteByStore('SIGMA');
    expect(deleted).toBe(2);

    const count = await repository.countByStore('SIGMA');
    expect(count).toBe(0);
  });

  it('updates externalId via dedicated method', async () => {
    const url = 'https://www.sigma.com/update-ext';
    await repository.upsert({
      storeCode: 'SIGMA',
      canonicalUrl: url,
      scrapeRunId: runId,
    });

    const updated = await repository.updateExternalId('SIGMA', url, 'EXT-999');
    expect(updated?.externalId).toBe('EXT-999');
  });
});
