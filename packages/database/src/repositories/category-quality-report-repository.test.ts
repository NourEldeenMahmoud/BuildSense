import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import {
  CategoryQualityReportRepository,
  evaluateFactGate,
} from './category-quality-report-repository.js';

// ---------------------------------------------------------------------------
// evaluateFactGate (pure, no DB)
// ---------------------------------------------------------------------------

describe('evaluateFactGate', () => {
  it('passes when coverage >= 80% and no verification data', () => {
    const result = evaluateFactGate(
      { factKey: 'cpu.socket', extractableCount: 80, verifiedCorrect: null, verifiedSampleSize: null },
      100,
    );
    expect(result.passes).toBe(true);
    expect(result.coverage).toBe(0.80);
    expect(result.precision).toBeNull();
    expect(result.failReason).toBe('');
  });

  it('fails when coverage < 80%', () => {
    const result = evaluateFactGate(
      { factKey: 'cpu.socket', extractableCount: 70, verifiedCorrect: null, verifiedSampleSize: null },
      100,
    );
    expect(result.passes).toBe(false);
    expect(result.coverage).toBe(0.70);
    expect(result.failReason).toContain('coverage');
  });

  it('passes when coverage >= 80% and precision >= 95% with sufficient sample', () => {
    const result = evaluateFactGate(
      { factKey: 'cpu.socket', extractableCount: 90, verifiedCorrect: 88, verifiedSampleSize: 90 },
      100,
    );
    expect(result.passes).toBe(true);
    expect(result.coverage).toBe(0.90);
    expect(result.precision).toBeCloseTo(0.978, 2);
  });

  it('fails when precision < 95% with sufficient sample', () => {
    const result = evaluateFactGate(
      { factKey: 'cpu.socket', extractableCount: 90, verifiedCorrect: 80, verifiedSampleSize: 90 },
      100,
    );
    expect(result.passes).toBe(false);
    expect(result.failReason).toContain('precision');
  });

  it('fails when verified sample < 50 and < totalProducts', () => {
    const result = evaluateFactGate(
      { factKey: 'cpu.socket', extractableCount: 90, verifiedCorrect: 30, verifiedSampleSize: 30 },
      100,
    );
    expect(result.passes).toBe(false);
    expect(result.failReason).toContain('sample');
  });

  it('passes when verified sample < 50 but >= totalProducts (small category)', () => {
    const result = evaluateFactGate(
      { factKey: 'cpu.socket', extractableCount: 30, verifiedCorrect: 30, verifiedSampleSize: 30 },
      30,
    );
    expect(result.passes).toBe(true);
    expect(result.precision).toBe(1.0);
  });

  it('handles zero totalProducts gracefully', () => {
    const result = evaluateFactGate(
      { factKey: 'cpu.socket', extractableCount: 0, verifiedCorrect: null, verifiedSampleSize: null },
      0,
    );
    // 0/0 = NaN in JS, which is < 0.80 → gate fails (safe default)
    expect(result.passes).toBe(false);
    expect(result.coverage).toBe(0);
  });

  it('passes when coverage is exactly 100%', () => {
    const result = evaluateFactGate(
      { factKey: 'cpu.socket', extractableCount: 100, verifiedCorrect: null, verifiedSampleSize: null },
      100,
    );
    expect(result.passes).toBe(true);
    expect(result.coverage).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// CategoryQualityReportRepository (DB)
// ---------------------------------------------------------------------------

describe('CategoryQualityReportRepository', () => {
  let repo: CategoryQualityReportRepository;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    repo = new CategoryQualityReportRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // -------------------------------------------------------------------------
  // upsert
  // -------------------------------------------------------------------------

  describe('upsert', () => {
    it('creates a new report', async () => {
      const report = await repo.upsert({
        category: 'CPU',
        extractorVersion: 'cpu/v1.0.0',
        totalProducts: 100,
        factMetrics: [
          { factKey: 'cpu.socket', extractableCount: 95, coverage: 0.95, verifiedCorrect: null, verifiedSampleSize: null, precision: null },
        ],
        allGatesPass: false,
      });

      expect(report.category).toBe('CPU');
      expect(report.extractorVersion).toBe('cpu/v1.0.0');
      expect(report.totalProducts).toBe(100);
      expect(report.factMetrics).toHaveLength(1);
      expect(report.allGatesPass).toBe(false);
    });

    it('is idempotent — re-upsert overwrites', async () => {
      await repo.upsert({
        category: 'CPU',
        extractorVersion: 'cpu/v1.0.0',
        totalProducts: 50,
        factMetrics: [],
        allGatesPass: false,
      });

      const updated = await repo.upsert({
        category: 'CPU',
        extractorVersion: 'cpu/v1.0.0',
        totalProducts: 100,
        factMetrics: [{ factKey: 'cpu.socket', extractableCount: 90, coverage: 0.9, verifiedCorrect: null, verifiedSampleSize: null, precision: null }],
        allGatesPass: true,
      });

      expect(updated.totalProducts).toBe(100);
      expect(updated.factMetrics).toHaveLength(1);
      expect(updated.allGatesPass).toBe(true);
    });

    it('separates reports by extractorVersion (version isolation)', async () => {
      await repo.upsert({
        category: 'CPU',
        extractorVersion: 'cpu/v0.9.0',
        totalProducts: 50,
        factMetrics: [],
        allGatesPass: false,
      });

      await repo.upsert({
        category: 'CPU',
        extractorVersion: 'cpu/v1.0.0',
        totalProducts: 100,
        factMetrics: [],
        allGatesPass: true,
      });

      const v1 = await repo.findByCategoryAndVersion('CPU', 'cpu/v0.9.0');
      const v2 = await repo.findByCategoryAndVersion('CPU', 'cpu/v1.0.0');

      expect(v1).not.toBeNull();
      expect(v2).not.toBeNull();
      expect(v1!.totalProducts).toBe(50);
      expect(v2!.totalProducts).toBe(100);
    });

    it('separates reports by category', async () => {
      await repo.upsert({
        category: 'CPU',
        extractorVersion: 'cpu/v1.0.0',
        totalProducts: 100,
        factMetrics: [],
        allGatesPass: false,
      });

      await repo.upsert({
        category: 'GPU',
        extractorVersion: 'cpu/v1.0.0',
        totalProducts: 80,
        factMetrics: [],
        allGatesPass: false,
      });

      const cpu = await repo.findByCategoryAndVersion('CPU', 'cpu/v1.0.0');
      const gpu = await repo.findByCategoryAndVersion('GPU', 'cpu/v1.0.0');

      expect(cpu!.totalProducts).toBe(100);
      expect(gpu!.totalProducts).toBe(80);
    });
  });

  // -------------------------------------------------------------------------
  // findByCategoryAndVersion
  // -------------------------------------------------------------------------

  describe('findByCategoryAndVersion', () => {
    it('finds an existing report', async () => {
      await repo.upsert({
        category: 'CPU',
        extractorVersion: 'cpu/v1.0.0',
        totalProducts: 100,
        factMetrics: [],
        allGatesPass: false,
      });

      const found = await repo.findByCategoryAndVersion('CPU', 'cpu/v1.0.0');
      expect(found).not.toBeNull();
      expect(found!.category).toBe('CPU');
    });

    it('returns null for non-existent report', async () => {
      const found = await repo.findByCategoryAndVersion('CPU', 'cpu/v1.0.0');
      expect(found).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // findLatest
  // -------------------------------------------------------------------------

  describe('findLatest', () => {
    it('returns the most recently evaluated report', async () => {
      // Create two reports with different evaluatedAt
      await repo.upsert({
        category: 'CPU',
        extractorVersion: 'cpu/v0.9.0',
        totalProducts: 50,
        factMetrics: [],
        allGatesPass: false,
      });

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 20));

      await repo.upsert({
        category: 'CPU',
        extractorVersion: 'cpu/v1.0.0',
        totalProducts: 100,
        factMetrics: [],
        allGatesPass: true,
      });

      const latest = await repo.findLatest('CPU');
      expect(latest).not.toBeNull();
      expect(latest!.extractorVersion).toBe('cpu/v1.0.0');
    });

    it('returns null when no reports exist', async () => {
      const latest = await repo.findLatest('CPU');
      expect(latest).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // computeAndUpsert
  // -------------------------------------------------------------------------

  describe('computeAndUpsert', () => {
    it('computes coverage from extraction stats', async () => {
      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: null, verifiedSampleSize: null },
        { factKey: 'cpu.tdp', extractableCount: 80, verifiedCorrect: null, verifiedSampleSize: null },
      ]);

      expect(report.factMetrics).toHaveLength(2);
      expect(report.factMetrics[0]!.coverage).toBe(0.95);
      expect(report.factMetrics[1]!.coverage).toBe(0.80);
      // Both pass coverage gate, no precision data yet
      expect(report.allGatesPass).toBe(true);
    });

    it('marks allGatesPass as false when any fact fails', async () => {
      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: null, verifiedSampleSize: null },
        { factKey: 'cpu.tdp', extractableCount: 50, verifiedCorrect: null, verifiedSampleSize: null }, // 50% coverage
      ]);

      expect(report.allGatesPass).toBe(false);
    });

    it('computes precision when verification data is present', async () => {
      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: 92, verifiedSampleSize: 95 },
      ]);

      const metric = report.factMetrics[0]!;
      expect(metric.precision).toBeCloseTo(0.968, 2);
      expect(metric.verifiedCorrect).toBe(92);
      expect(metric.verifiedSampleSize).toBe(95);
    });

    it('sets allGatesPass false when precision is below threshold', async () => {
      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: 85, verifiedSampleSize: 95 },
      ]);

      expect(report.allGatesPass).toBe(false);
    });

    it('sets allGatesPass false when verified sample is insufficient', async () => {
      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: 30, verifiedSampleSize: 30 },
      ]);

      expect(report.allGatesPass).toBe(false);
    });

    it('handles empty factStats (no facts extracted)', async () => {
      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, []);
      expect(report.factMetrics).toHaveLength(0);
      expect(report.allGatesPass).toBe(false); // vacuous: no facts = not all passing
    });
  });

  // -------------------------------------------------------------------------
  // isFactGatePassing
  // -------------------------------------------------------------------------

  describe('isFactGatePassing', () => {
    it('returns true when fact gate passes', async () => {
      await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: null, verifiedSampleSize: null },
      ]);

      expect(await repo.isFactGatePassing('CPU', 'cpu/v1.0.0', 'cpu.socket')).toBe(true);
    });

    it('returns false when fact gate fails', async () => {
      await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 50, verifiedCorrect: null, verifiedSampleSize: null },
      ]);

      expect(await repo.isFactGatePassing('CPU', 'cpu/v1.0.0', 'cpu.socket')).toBe(false);
    });

    it('returns false when no report exists', async () => {
      expect(await repo.isFactGatePassing('CPU', 'cpu/v1.0.0', 'cpu.socket')).toBe(false);
    });

    it('returns false when fact key is not in the report', async () => {
      await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: null, verifiedSampleSize: null },
      ]);

      expect(await repo.isFactGatePassing('CPU', 'cpu/v1.0.0', 'cpu.tdp')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Req 6: Quality safety properties
  // -------------------------------------------------------------------------

  describe('quality safety properties', () => {
    const ALL_EXPECTED_CPU_KEYS = [
      'cpu.socket', 'cpu.family', 'cpu.iGpu', 'cpu.tdpWatts',
    ];

    it('includes all expected fact keys at zero coverage', async () => {
      // Feed zero-extraction stats for all 4 CPU keys
      const stats = ALL_EXPECTED_CPU_KEYS.map((key) => ({
        factKey: key,
        extractableCount: 0,
        verifiedCorrect: null,
        verifiedSampleSize: null,
      }));

      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, stats);

      // All keys should be present in the report
      const reportedKeys = report.factMetrics.map((m) => m.factKey);
      expect(reportedKeys.sort()).toEqual(ALL_EXPECTED_CPU_KEYS.sort());

      // Coverage should be 0 for all
      for (const metric of report.factMetrics) {
        expect(metric.coverage).toBe(0);
      }

      // allGatesPass should be false (coverage 0% < 80%)
      expect(report.allGatesPass).toBe(false);
    });

    it('null fact values are excluded from extractableCount', async () => {
      // 100 products, but only 80 have non-null cpu.socket
      const stats = [
        { factKey: 'cpu.socket', extractableCount: 80, verifiedCorrect: null, verifiedSampleSize: null },
      ];

      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, stats);
      expect(report.factMetrics[0]!.coverage).toBe(0.80);
      // The other 20 products had null → not counted as extractable
    });

    it('precision is never derived from confidence', async () => {
      // Even if extractableCount is high, precision comes ONLY from
      // verifiedCorrect/verifiedSampleSize, never from confidence values
      const stats = [
        { factKey: 'cpu.socket', extractableCount: 100, verifiedCorrect: null, verifiedSampleSize: null },
      ];

      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, stats);
      // precision should be null (no verified data), regardless of confidence
      expect(report.factMetrics[0]!.precision).toBeNull();
    });

    it('verified fields are null when not yet verified', async () => {
      const stats = [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: null, verifiedSampleSize: null },
      ];

      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, stats);
      expect(report.factMetrics[0]!.verifiedCorrect).toBeNull();
      expect(report.factMetrics[0]!.verifiedSampleSize).toBeNull();
      expect(report.factMetrics[0]!.precision).toBeNull();
    });

    it('allGatesPass is false when all facts have zero coverage', async () => {
      const stats = ALL_EXPECTED_CPU_KEYS.map((key) => ({
        factKey: key,
        extractableCount: 0,
        verifiedCorrect: null,
        verifiedSampleSize: null,
      }));

      const report = await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, stats);
      expect(report.allGatesPass).toBe(false);
    });

    it('gates are isolated by category', async () => {
      // CPU passes, GPU fails
      await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: null, verifiedSampleSize: null },
      ]);
      await repo.computeAndUpsert('GPU', 'gpu/v1.0.0', 100, [
        { factKey: 'gpu.lengthMM', extractableCount: 50, verifiedCorrect: null, verifiedSampleSize: null },
      ]);

      const cpuReport = await repo.findByCategoryAndVersion('CPU', 'cpu/v1.0.0');
      const gpuReport = await repo.findByCategoryAndVersion('GPU', 'gpu/v1.0.0');

      expect(cpuReport!.allGatesPass).toBe(true);
      expect(gpuReport!.allGatesPass).toBe(false);
    });

    it('gates are isolated by extractor version', async () => {
      // v0.9.0 fails, v1.0.0 passes
      await repo.computeAndUpsert('CPU', 'cpu/v0.9.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 50, verifiedCorrect: null, verifiedSampleSize: null },
      ]);
      await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: null, verifiedSampleSize: null },
      ]);

      const old = await repo.findByCategoryAndVersion('CPU', 'cpu/v0.9.0');
      const latest = await repo.findByCategoryAndVersion('CPU', 'cpu/v1.0.0');

      expect(old!.allGatesPass).toBe(false);
      expect(latest!.allGatesPass).toBe(true);
    });

    it('re-running computeAndUpsert with same key is idempotent', async () => {
      const stats = [
        { factKey: 'cpu.socket', extractableCount: 95, verifiedCorrect: null, verifiedSampleSize: null },
      ];

      await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, stats);
      await repo.computeAndUpsert('CPU', 'cpu/v1.0.0', 100, stats);

      const reports = await repo.findAllByCategory('CPU');
      // Should be exactly 1 report (upsert, not insert)
      expect(reports).toHaveLength(1);
      expect(reports[0]!.allGatesPass).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // deleteByCategory
  // -------------------------------------------------------------------------

  describe('deleteByCategory', () => {
    it('deletes all reports for a category', async () => {
      await repo.upsert({
        category: 'CPU', extractorVersion: 'cpu/v0.9.0',
        totalProducts: 50, factMetrics: [], allGatesPass: false,
      });
      await repo.upsert({
        category: 'CPU', extractorVersion: 'cpu/v1.0.0',
        totalProducts: 100, factMetrics: [], allGatesPass: true,
      });
      await repo.upsert({
        category: 'GPU', extractorVersion: 'gpu/v1.0.0',
        totalProducts: 80, factMetrics: [], allGatesPass: false,
      });

      const deleted = await repo.deleteByCategory('CPU');
      expect(deleted).toBe(2);

      const cpuReports = await repo.findAllByCategory('CPU');
      expect(cpuReports).toHaveLength(0);

      // GPU reports untouched
      const gpuReports = await repo.findAllByCategory('GPU');
      expect(gpuReports).toHaveLength(1);
    });

    it('returns 0 when no reports match', async () => {
      const deleted = await repo.deleteByCategory('RAM');
      expect(deleted).toBe(0);
    });
  });
});
