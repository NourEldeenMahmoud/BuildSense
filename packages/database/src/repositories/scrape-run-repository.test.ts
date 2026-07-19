import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import { ScrapeRunRepository } from './scrape-run-repository.js';
import { ScrapeRunModel } from '../models/scrape-run.js';

describe('ScrapeRunRepository', () => {
  let repository: ScrapeRunRepository;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    repository = new ScrapeRunRepository();
    // Ensure unique indexes are created on the in-memory MongoDB
    await ScrapeRunModel.ensureIndexes();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('creates a new scrape run', async () => {
    const run = await repository.create({
      storeCode: 'SIGMA',
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

  it('creates a new scrape run with EL_BADR storeCode', async () => {
    const run = await repository.create({
      storeCode: 'EL_BADR',
      runId: 'test-run-001b',
      mode: 'URL',
    });

    expect(run).toBeDefined();
    expect(run.runId).toBe('test-run-001b');
    expect(run.storeCode).toBe('EL_BADR');
  });

  it('finds a run by runId scoped to storeCode', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'test-run-002', mode: 'CATEGORY' });
    const found = await repository.findByRunId('test-run-002', 'SIGMA');

    expect(found).toBeDefined();
    expect(found?.runId).toBe('test-run-002');
    expect(found?.mode).toBe('CATEGORY');
  });

  it('does not find a SIGMA run when querying EL_BADR', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'test-run-cross', mode: 'FULL' });
    const found = await repository.findByRunId('test-run-cross', 'EL_BADR');
    expect(found).toBeNull();
  });

  it('returns null for non-existent runId', async () => {
    const found = await repository.findByRunId('non-existent', 'SIGMA');
    expect(found).toBeNull();
  });

  it('updates a run by runId', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'test-run-003', mode: 'URL' });
    const updated = await repository.updateByRunId('test-run-003', {
      status: 'RUNNING',
      startedAt: new Date(),
    }, 'SIGMA');

    expect(updated?.status).toBe('RUNNING');
    expect(updated?.startedAt).toBeDefined();
  });

  it('finds a resumable run', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'test-run-004', mode: 'FULL' });
    const resumable = await repository.findResumableRun('FULL', 'SIGMA');

    expect(resumable).toBeDefined();
    expect(resumable?.runId).toBe('test-run-004');
  });

  it('cancels a run', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'test-run-005', mode: 'FULL' });
    const cancelled = await repository.cancelByRunId('test-run-005', 'SIGMA');

    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.completedAt).toBeDefined();
  });

  it('enforces unique constraint on storeCode + runId', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'test-run-006', mode: 'FULL' });

    await expect(
      repository.create({ storeCode: 'SIGMA', runId: 'test-run-006', mode: 'CATEGORY' }),
    ).rejects.toThrow();
  });

  it('allows same runId across different stores', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'test-run-shared', mode: 'FULL' });
    const elBadr = await repository.create({ storeCode: 'EL_BADR', runId: 'test-run-shared', mode: 'URL' });

    expect(elBadr).toBeDefined();
    expect(elBadr.storeCode).toBe('EL_BADR');

    const sigma = await repository.findByRunId('test-run-shared', 'SIGMA');
    const elBadrFound = await repository.findByRunId('test-run-shared', 'EL_BADR');
    expect(sigma).toBeDefined();
    expect(elBadrFound).toBeDefined();
    expect(sigma!.storeCode).toBe('SIGMA');
    expect(elBadrFound!.storeCode).toBe('EL_BADR');
  });

  it('upserts a category audit entry for a new seed', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'audit-001', mode: 'FULL' });

    const entry = { seedId: 'cpu', pagesProcessed: 1, productsDiscovered: 10, completed: false };
    const result = await repository.upsertCategoryAudit('audit-001', entry, 'SIGMA');

    expect(result).toBeDefined();
    expect(result!.categoryAudit).toHaveLength(1);
    expect(result!.categoryAudit![0]!.seedId).toBe('cpu');
    expect(result!.categoryAudit![0]!.pagesProcessed).toBe(1);
  });

  it('upserts a category audit entry by updating existing seed', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'audit-002', mode: 'FULL' });

    await repository.upsertCategoryAudit('audit-002', {
      seedId: 'gpu', pagesProcessed: 1, productsDiscovered: 5, completed: false,
    }, 'SIGMA');

    const updated = await repository.upsertCategoryAudit('audit-002', {
      seedId: 'gpu', pagesProcessed: 2, productsDiscovered: 10, completed: true,
    }, 'SIGMA');

    expect(updated).toBeDefined();
    expect(updated!.categoryAudit).toHaveLength(1);
    expect(updated!.categoryAudit![0]!.pagesProcessed).toBe(2);
    expect(updated!.categoryAudit![0]!.completed).toBe(true);
  });

  it('handles concurrent updates to different seeds without duplicates', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'audit-003', mode: 'FULL' });

    // Simulate concurrent pushes of different seedIds
    const results = await Promise.all([
      repository.upsertCategoryAudit('audit-003', {
        seedId: 'cpu', pagesProcessed: 1, productsDiscovered: 5, completed: true,
      }, 'SIGMA'),
      repository.upsertCategoryAudit('audit-003', {
        seedId: 'gpu', pagesProcessed: 1, productsDiscovered: 3, completed: true,
      }, 'SIGMA'),
      repository.upsertCategoryAudit('audit-003', {
        seedId: 'ram', pagesProcessed: 1, productsDiscovered: 2, completed: true,
      }, 'SIGMA'),
    ]);

    // The last result should have all 3 entries
    const final = results[results.length - 1]!;
    expect(final).toBeDefined();
    const seedIds = final.categoryAudit!.map((e) => e.seedId).sort();
    expect(seedIds).toEqual(['cpu', 'gpu', 'ram']);
  });

  it('handles concurrent updates to the same seed', async () => {
    await repository.create({ storeCode: 'SIGMA', runId: 'audit-004', mode: 'FULL' });

    // First push the initial entry
    await repository.upsertCategoryAudit('audit-004', {
      seedId: 'cpu', pagesProcessed: 0, productsDiscovered: 0, completed: false,
    }, 'SIGMA');

    // Simulate concurrent updates to the same seed
    const results = await Promise.all([
      repository.upsertCategoryAudit('audit-004', {
        seedId: 'cpu', pagesProcessed: 1, productsDiscovered: 5, completed: false,
      }, 'SIGMA'),
      repository.upsertCategoryAudit('audit-004', {
        seedId: 'cpu', pagesProcessed: 2, productsDiscovered: 10, completed: true,
      }, 'SIGMA'),
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
    }, 'SIGMA');
    expect(result).toBeNull();
  });
});
