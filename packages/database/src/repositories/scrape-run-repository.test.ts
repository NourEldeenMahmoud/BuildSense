import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import { ScrapeRunRepository } from './scrape-run-repository.js';

describe('ScrapeRunRepository', () => {
  let repository: ScrapeRunRepository;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    repository = new ScrapeRunRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('creates a new scrape run', async () => {
    const run = await repository.create({
      runId: 'test-run-001',
      mode: 'FULL',
    });

    expect(run).toBeDefined();
    expect(run.runId).toBe('test-run-001');
    expect(run.mode).toBe('FULL');
    expect(run.status).toBe('CREATED');
    expect(run.stage).toBe('DISCOVERY');
    expect(run.storeCode).toBe('SIGMA');
  });

  it('finds a run by runId', async () => {
    await repository.create({ runId: 'test-run-002', mode: 'CATEGORY' });
    const found = await repository.findByRunId('test-run-002');

    expect(found).toBeDefined();
    expect(found?.runId).toBe('test-run-002');
    expect(found?.mode).toBe('CATEGORY');
  });

  it('returns null for non-existent runId', async () => {
    const found = await repository.findByRunId('non-existent');
    expect(found).toBeNull();
  });

  it('updates a run by runId', async () => {
    await repository.create({ runId: 'test-run-003', mode: 'URL' });
    const updated = await repository.updateByRunId('test-run-003', {
      status: 'RUNNING',
      startedAt: new Date(),
    });

    expect(updated?.status).toBe('RUNNING');
    expect(updated?.startedAt).toBeDefined();
  });

  it('finds a resumable run', async () => {
    await repository.create({ runId: 'test-run-004', mode: 'FULL' });
    const resumable = await repository.findResumableRun('FULL');

    expect(resumable).toBeDefined();
    expect(resumable?.runId).toBe('test-run-004');
  });

  it('cancels a run', async () => {
    await repository.create({ runId: 'test-run-005', mode: 'FULL' });
    const cancelled = await repository.cancelByRunId('test-run-005');

    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.completedAt).toBeDefined();
  });

  it('enforces unique constraint on storeCode + runId', async () => {
    await repository.create({ runId: 'test-run-006', mode: 'FULL' });

    await expect(
      repository.create({ runId: 'test-run-006', mode: 'CATEGORY' }),
    ).rejects.toThrow();
  });

  it('upserts a category audit entry for a new seed', async () => {
    await repository.create({ runId: 'audit-001', mode: 'FULL' });

    const entry = { seedId: 'cpu', pagesProcessed: 1, productsDiscovered: 10, completed: false };
    const result = await repository.upsertCategoryAudit('audit-001', entry);

    expect(result).toBeDefined();
    expect(result!.categoryAudit).toHaveLength(1);
    expect(result!.categoryAudit![0]!.seedId).toBe('cpu');
    expect(result!.categoryAudit![0]!.pagesProcessed).toBe(1);
  });

  it('upserts a category audit entry by updating existing seed', async () => {
    await repository.create({ runId: 'audit-002', mode: 'FULL' });

    await repository.upsertCategoryAudit('audit-002', {
      seedId: 'gpu', pagesProcessed: 1, productsDiscovered: 5, completed: false,
    });

    const updated = await repository.upsertCategoryAudit('audit-002', {
      seedId: 'gpu', pagesProcessed: 2, productsDiscovered: 10, completed: true,
    });

    expect(updated).toBeDefined();
    expect(updated!.categoryAudit).toHaveLength(1);
    expect(updated!.categoryAudit![0]!.pagesProcessed).toBe(2);
    expect(updated!.categoryAudit![0]!.completed).toBe(true);
  });

  it('handles concurrent updates to different seeds without duplicates', async () => {
    await repository.create({ runId: 'audit-003', mode: 'FULL' });

    // Simulate concurrent pushes of different seedIds
    const results = await Promise.all([
      repository.upsertCategoryAudit('audit-003', {
        seedId: 'cpu', pagesProcessed: 1, productsDiscovered: 5, completed: true,
      }),
      repository.upsertCategoryAudit('audit-003', {
        seedId: 'gpu', pagesProcessed: 1, productsDiscovered: 3, completed: true,
      }),
      repository.upsertCategoryAudit('audit-003', {
        seedId: 'ram', pagesProcessed: 1, productsDiscovered: 2, completed: true,
      }),
    ]);

    // The last result should have all 3 entries
    const final = results[results.length - 1]!;
    expect(final).toBeDefined();
    const seedIds = final.categoryAudit!.map((e) => e.seedId).sort();
    expect(seedIds).toEqual(['cpu', 'gpu', 'ram']);
  });

  it('handles concurrent updates to the same seed', async () => {
    await repository.create({ runId: 'audit-004', mode: 'FULL' });

    // First push the initial entry
    await repository.upsertCategoryAudit('audit-004', {
      seedId: 'cpu', pagesProcessed: 0, productsDiscovered: 0, completed: false,
    });

    // Simulate concurrent updates to the same seed
    const results = await Promise.all([
      repository.upsertCategoryAudit('audit-004', {
        seedId: 'cpu', pagesProcessed: 1, productsDiscovered: 5, completed: false,
      }),
      repository.upsertCategoryAudit('audit-004', {
        seedId: 'cpu', pagesProcessed: 2, productsDiscovered: 10, completed: true,
      }),
    ]);

    // Should have exactly 1 entry for cpu (no duplicates)
    const final = results[results.length - 1]!;
    expect(final).toBeDefined();
    const cpuEntries = final.categoryAudit!.filter((e) => e.seedId === 'cpu');
    expect(cpuEntries).toHaveLength(1);
  });

  it('returns null when run does not exist', async () => {
    const result = await repository.upsertCategoryAudit('nonexistent', {
      seedId: 'cpu', pagesProcessed: 1, productsDiscovered: 5, completed: true,
    });
    expect(result).toBeNull();
  });
});
