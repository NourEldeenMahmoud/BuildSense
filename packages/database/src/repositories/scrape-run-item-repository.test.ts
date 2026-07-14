import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import { ScrapeRunRepository } from './scrape-run-repository.js';
import { ScrapeRunItemRepository } from './scrape-run-item-repository.js';

describe('ScrapeRunItemRepository', () => {
  let runRepository: ScrapeRunRepository;
  let itemRepository: ScrapeRunItemRepository;
  let runId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    runRepository = new ScrapeRunRepository();
    itemRepository = new ScrapeRunItemRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    const run = await runRepository.create({ runId: 'test-run-items', mode: 'FULL' });
    runId = run._id;
  });

  it('upserts a new item', async () => {
    const item = await itemRepository.upsert({
      scrapeRunId: runId,
      canonicalUrl: 'https://www.sigma-computer.com/en/item?id=test-product',
      categorySeedId: 'cpu',
    });

    expect(item).toBeDefined();
    expect(item.canonicalUrl).toBe('https://www.sigma-computer.com/en/item?id=test-product');
    expect(item.fetchState).toBe('PENDING');
    expect(item.attempts).toBe(0);
  });

  it('upserts existing item without duplicating', async () => {
    const url = 'https://www.sigma-computer.com/en/item?id=product-1';
    await itemRepository.upsert({ scrapeRunId: runId, canonicalUrl: url });
    await itemRepository.upsert({ scrapeRunId: runId, canonicalUrl: url });

    const items = await itemRepository.findByRunId(runId);
    expect(items).toHaveLength(1);
  });

  it('updates item state', async () => {
    const url = 'https://www.sigma-computer.com/en/item?id=product-2';
    await itemRepository.upsert({ scrapeRunId: runId, canonicalUrl: url });

    const updated = await itemRepository.updateByCanonicalUrl(runId, url, {
      fetchState: 'FETCHED',
      attempts: 1,
    });

    expect(updated?.fetchState).toBe('FETCHED');
    expect(updated?.attempts).toBe(1);
  });

  it('counts items by state', async () => {
    const url1 = 'https://www.sigma-computer.com/en/item?id=product-a';
    const url2 = 'https://www.sigma-computer.com/en/item?id=product-b';
    const url3 = 'https://www.sigma-computer.com/en/item?id=product-c';

    await itemRepository.upsert({ scrapeRunId: runId, canonicalUrl: url1 });
    await itemRepository.upsert({ scrapeRunId: runId, canonicalUrl: url2 });
    await itemRepository.upsert({ scrapeRunId: runId, canonicalUrl: url3 });

    await itemRepository.updateByCanonicalUrl(runId, url1, { fetchState: 'FETCHED' });
    await itemRepository.updateByCanonicalUrl(runId, url2, { fetchState: 'FAILED' });

    const counts = await itemRepository.countByState(runId);
    expect(counts.PENDING).toBe(1);
    expect(counts.FETCHED).toBe(1);
    expect(counts.FAILED).toBe(1);
    expect(counts.SKIPPED).toBe(0);
  });

  it('checks if item exists by runId and URL', async () => {
    const url = 'https://www.sigma-computer.com/en/item?id=product-exists';
    await itemRepository.upsert({ scrapeRunId: runId, canonicalUrl: url });

    const exists = await itemRepository.existsByRunIdAndUrl(runId, url);
    expect(exists).toBe(true);

    const notExists = await itemRepository.existsByRunIdAndUrl(runId, 'https://other.com');
    expect(notExists).toBe(false);
  });
});
