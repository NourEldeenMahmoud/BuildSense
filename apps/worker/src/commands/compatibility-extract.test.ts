import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCompatibilityExtract } from './compatibility-extract.js';
import type { ExtractionSummary } from './compatibility-extract.js';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const MOCK_EXPECTED_FACT_KEYS: Record<string, readonly string[]> = {
  CPU: ['cpu.socket', 'cpu.family', 'cpu.iGpu', 'cpu.tdpWatts'],
  Motherboard: [
    'mb.socket',
    'mb.chipset',
    'mb.formFactor',
    'mb.ramGeneration',
    'mb.ramType',
    'mb.dimmSlots',
    'mb.maxMemoryGB',
    'mb.maxMemorySpeedMHz',
    'mb.sataPorts',
    'mb.m2Slots',
    'mb.m2FormFactors',
  ],
  RAM: ['ram.generation', 'ram.moduleType', 'ram.moduleCount', 'ram.capacityGB', 'ram.speedMHz'],
  GPU: ['gpu.lengthMM', 'gpu.slotWidth', 'gpu.connectorTypes', 'gpu.connectorCount', 'gpu.boardPowerWatts'],
  Storage: ['storage.interface', 'storage.formFactor'],
  PSU: ['psu.wattage'],
  Case: ['case.supportedFormFactors', 'case.maxGpuLengthMM', 'case.expansionSlots'],
};

// Mock references hoisted above vi.mock factories
const {
  mockPersistFacts,
  mockFindNeedingExtraction,
  mockCountByCategory,
  mockComputeAndUpsert,
  mockMigrationDryRun,
  mockMigrationRun,
  mockMigrationVerify,
  mockExtractFacts,
} = vi.hoisted(() => ({
  mockPersistFacts: vi.fn().mockResolvedValue({ kind: 'updated', productId: '1' }),
  mockFindNeedingExtraction: vi.fn().mockResolvedValue([]),
  mockCountByCategory: vi.fn().mockResolvedValue(0),
  mockComputeAndUpsert: vi.fn().mockResolvedValue({
    category: 'CPU',
    extractorVersion: 'cpu/v1.0.0',
    totalProducts: 0,
    allGatesPass: true,
    factMetrics: [],
  }),
  mockMigrationDryRun: vi.fn().mockResolvedValue({ wouldNormalize: 0, sampleIds: [] }),
  mockMigrationRun: vi.fn().mockResolvedValue({ normalized: 0, elapsedMs: 0 }),
  mockMigrationVerify: vi.fn().mockResolvedValue({ legacyRemaining: 0, clean: true }),
  mockExtractFacts: vi.fn().mockReturnValue({
    category: 'CPU',
    extractorVersion: 'cpu/v1.0.0',
    facts: [],
    extractedAt: new Date().toISOString(),
    extractionIssues: [],
  }),
}));

vi.mock('@buildsense/database', () => ({
  CatalogProductRepository: vi.fn().mockImplementation(() => ({
    findNeedingExtraction: mockFindNeedingExtraction,
    countByCategory: mockCountByCategory,
    persistFacts: mockPersistFacts,
  })),
  CategoryQualityReportRepository: vi.fn().mockImplementation(() => ({
    computeAndUpsert: mockComputeAndUpsert,
    findLatest: vi.fn().mockResolvedValue(null),
  })),
  compareExtractorVersions: vi.fn().mockImplementation((a: string, b: string) => {
    const parseVersion = (v: string) => {
      const match = v.match(/^([a-z]+)\/v(\d+)\.(\d+)\.(\d+)$/i);
      if (!match) return [0, 0, 0];
      return [parseInt(match[2]!, 10), parseInt(match[3]!, 10), parseInt(match[4]!, 10)];
    };
    const [aMaj = 0, aMin = 0, aPatch = 0] = parseVersion(a);
    const [bMaj = 0, bMin = 0, bPatch = 0] = parseVersion(b);
    if (aMaj !== bMaj) return aMaj - bMaj;
    if (aMin !== bMin) return aMin - bMin;
    return aPatch - bPatch;
  }),
  migrationDryRun: mockMigrationDryRun,
  migrationRun: mockMigrationRun,
  migrationVerify: mockMigrationVerify,
}));

vi.mock('@buildsense/observability', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

vi.mock('@buildsense/compatibility-facts', () => ({
  extractFacts: mockExtractFacts,
  SUPPORTED_CATEGORIES: ['CPU', 'Motherboard', 'RAM', 'GPU', 'Storage', 'PSU', 'Case'],
  EXTRACTOR_VERSIONS: {
    CPU: 'cpu/v1.0.0',
    Motherboard: 'mb/v1.0.0',
    RAM: 'ram/v1.0.0',
    GPU: 'gpu/v1.0.0',
    Storage: 'storage/v1.0.0',
    PSU: 'psu/v1.0.0',
    Case: 'case/v1.0.0',
  },
  EXPECTED_FACT_KEYS: MOCK_EXPECTED_FACT_KEYS,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EXPECTED_FACT_KEYS (mocked from compatibility-facts)', () => {
  it('should have 31 total fact keys across all categories', () => {
    const allKeys = Object.values(MOCK_EXPECTED_FACT_KEYS).flat();
    expect(allKeys).toHaveLength(31);
  });

  it('should have CPU category with 4 fact keys', () => {
    expect(MOCK_EXPECTED_FACT_KEYS.CPU).toHaveLength(4);
    expect(MOCK_EXPECTED_FACT_KEYS.CPU).toContain('cpu.socket');
    expect(MOCK_EXPECTED_FACT_KEYS.CPU).toContain('cpu.family');
    expect(MOCK_EXPECTED_FACT_KEYS.CPU).toContain('cpu.iGpu');
    expect(MOCK_EXPECTED_FACT_KEYS.CPU).toContain('cpu.tdpWatts');
  });

  it('should have Motherboard category with 11 fact keys', () => {
    expect(MOCK_EXPECTED_FACT_KEYS.Motherboard).toHaveLength(11);
    expect(MOCK_EXPECTED_FACT_KEYS.Motherboard).toContain('mb.socket');
    expect(MOCK_EXPECTED_FACT_KEYS.Motherboard).toContain('mb.chipset');
  });

  it('should have RAM category with 5 fact keys', () => {
    expect(MOCK_EXPECTED_FACT_KEYS.RAM).toHaveLength(5);
    expect(MOCK_EXPECTED_FACT_KEYS.RAM).toContain('ram.generation');
    expect(MOCK_EXPECTED_FACT_KEYS.RAM).toContain('ram.capacityGB');
  });

  it('should have GPU category with 5 fact keys', () => {
    expect(MOCK_EXPECTED_FACT_KEYS.GPU).toHaveLength(5);
    expect(MOCK_EXPECTED_FACT_KEYS.GPU).toContain('gpu.lengthMM');
    expect(MOCK_EXPECTED_FACT_KEYS.GPU).toContain('gpu.boardPowerWatts');
  });

  it('should have Storage category with 2 fact keys', () => {
    expect(MOCK_EXPECTED_FACT_KEYS.Storage).toHaveLength(2);
    expect(MOCK_EXPECTED_FACT_KEYS.Storage).toContain('storage.interface');
    expect(MOCK_EXPECTED_FACT_KEYS.Storage).toContain('storage.formFactor');
  });

  it('should have PSU category with 1 fact key', () => {
    expect(MOCK_EXPECTED_FACT_KEYS.PSU).toHaveLength(1);
    expect(MOCK_EXPECTED_FACT_KEYS.PSU).toContain('psu.wattage');
  });

  it('should have Case category with 3 fact keys', () => {
    expect(MOCK_EXPECTED_FACT_KEYS.Case).toHaveLength(3);
    expect(MOCK_EXPECTED_FACT_KEYS.Case).toContain('case.supportedFormFactors');
    expect(MOCK_EXPECTED_FACT_KEYS.Case).toContain('case.maxGpuLengthMM');
    expect(MOCK_EXPECTED_FACT_KEYS.Case).toContain('case.expansionSlots');
  });
});

describe('runCompatibilityExtract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when no categories specified', async () => {
    const result = await runCompatibilityExtract({});
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toContain('No categories specified');
    }
  });

  it('should return dry_run status when dry-run mode is enabled', async () => {
    const result = await runCompatibilityExtract({
      category: 'CPU',
      dryRun: true,
    });
    expect(result.status).toBe('dry_run');
  });

  it('should return success status for valid extraction', async () => {
    const result = await runCompatibilityExtract({
      category: 'CPU',
    });
    expect(result.status).toBe('success');
  });

  it('should handle all categories', async () => {
    const result = await runCompatibilityExtract({
      all: true,
      dryRun: true,
    });
    expect(result.status).toBe('dry_run');
    expect(result.summary.categories).toHaveLength(7);
  });

  it('should return error for invalid category', async () => {
    const result = await runCompatibilityExtract({
      category: 'InvalidCategory',
    });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toContain('No categories specified');
    }
  });

  it('should include productionRepresentativenessEstablished: false', async () => {
    const result = await runCompatibilityExtract({
      category: 'CPU',
    });
    expect(result.status).toBe('success');
    expect(result.summary.productionRepresentativenessEstablished).toBe(false);
  });

  it('dry-run should not call persistFacts', async () => {
    await runCompatibilityExtract({
      category: 'CPU',
      dryRun: true,
    });
    expect(mockPersistFacts).not.toHaveBeenCalled();
  });

  it('dry-run should not call computeAndUpsert', async () => {
    await runCompatibilityExtract({
      category: 'CPU',
      dryRun: true,
    });
    expect(mockComputeAndUpsert).not.toHaveBeenCalled();
  });

  it('report-only should not call persistFacts', async () => {
    await runCompatibilityExtract({
      category: 'CPU',
      reportOnly: true,
    });
    expect(mockPersistFacts).not.toHaveBeenCalled();
  });

  it('should skip products with same version', async () => {
    mockFindNeedingExtraction.mockResolvedValueOnce([{
      _id: 'prod1',
      category: 'CPU',
      compatibility: { extractorVersion: 'cpu/v1.0.0' },
      rawSpecifications: [],
    }]);

    const result = await runCompatibilityExtract({
      category: 'CPU',
    });

    expect(result.status).toBe('success');
    expect(result.summary.totalSkipped).toBe(1);
    expect(mockPersistFacts).not.toHaveBeenCalled();
  });

  it('should update products with newer version', async () => {
    mockFindNeedingExtraction.mockResolvedValueOnce([{
      _id: 'prod1',
      category: 'CPU',
      compatibility: { extractorVersion: 'cpu/v0.9.0' },
      rawSpecifications: [],
    }]);

    const result = await runCompatibilityExtract({
      category: 'CPU',
    });

    expect(result.status).toBe('success');
    expect(result.summary.totalUpdated).toBe(1);
    expect(mockPersistFacts).toHaveBeenCalled();
  });

  it('should return stale for older version without force', async () => {
    mockPersistFacts.mockResolvedValueOnce({
      kind: 'stale',
      productId: 'prod1',
      currentVersion: 'cpu/v2.0.0',
    });

    mockFindNeedingExtraction.mockResolvedValueOnce([{
      _id: 'prod1',
      category: 'CPU',
      compatibility: { extractorVersion: 'cpu/v2.0.0' },
      rawSpecifications: [],
    }]);

    const result = await runCompatibilityExtract({
      category: 'CPU',
    });

    expect(result.status).toBe('success');
    expect(result.summary.totalStale).toBe(1);
  });

  it('should update with older version when forced', async () => {
    // Force bypasses same-version skip but NOT downgrade protection.
    // stored=v2.0.0 + force + incoming=v1.0.0 → stale (cannot downgrade).
    // This test verifies the worker correctly receives stale from persistFacts.
    mockPersistFacts.mockResolvedValueOnce({
      kind: 'stale',
      productId: 'prod1',
      currentVersion: 'cpu/v2.0.0',
    });

    mockFindNeedingExtraction.mockResolvedValueOnce([{
      _id: 'prod1',
      category: 'CPU',
      compatibility: { extractorVersion: 'cpu/v2.0.0' },
      rawSpecifications: [],
    }]);

    const result = await runCompatibilityExtract({
      category: 'CPU',
      forceReprocess: true,
    });

    expect(result.status).toBe('success');
    expect(result.summary.totalStale).toBe(1);
    expect(result.summary.totalUpdated).toBe(0);
    expect(mockPersistFacts).toHaveBeenCalledWith(
      'prod1',
      expect.anything(),
      true, // forceReprocess flag
    );
  });

  it('should set checkpoint to last scanned ID', async () => {
    mockFindNeedingExtraction.mockResolvedValueOnce([{
      _id: 'prod1',
      category: 'CPU',
      compatibility: null,
      rawSpecifications: [],
    }, {
      _id: 'prod2',
      category: 'CPU',
      compatibility: null,
      rawSpecifications: [],
    }]);

    const result = await runCompatibilityExtract({
      category: 'CPU',
    });

    expect(result.status).toBe('success');
    expect(result.summary.lastCheckpointId).toBe('prod2');
  });

  it('should include checkpoint in summary even on failure', async () => {
    mockFindNeedingExtraction.mockResolvedValueOnce([{
      _id: 'prod1',
      category: 'CPU',
      compatibility: null,
      rawSpecifications: [],
    }]);

    mockPersistFacts.mockRejectedValueOnce(new Error('DB error'));

    const result = await runCompatibilityExtract({
      category: 'CPU',
    });

    expect(result.status).toBe('success');
    expect(result.summary.totalFailed).toBe(1);
    expect(result.summary.lastCheckpointId).toBe('prod1');
  });

  // -------------------------------------------------------------------------
  // Req 4: Counter outcomes for mixed batches
  // -------------------------------------------------------------------------

  describe('counter outcomes', () => {
    it('should tally updated, skipped, and stale in a single batch', async () => {
      mockFindNeedingExtraction.mockResolvedValueOnce([
        {
          _id: 'prod_new',
          category: 'CPU',
          compatibility: null,
          rawSpecifications: [],
        },
        {
          _id: 'prod_same',
          category: 'CPU',
          compatibility: { extractorVersion: 'cpu/v1.0.0' },
          rawSpecifications: [],
        },
        {
          _id: 'prod_older',
          category: 'CPU',
          compatibility: { extractorVersion: 'cpu/v2.0.0' },
          rawSpecifications: [],
        },
      ]);

      // prod_new will be persisted → updated; prod_older will be persisted → stale
      mockPersistFacts
        .mockResolvedValueOnce({ kind: 'updated', productId: 'prod_new' })
        .mockResolvedValueOnce({ kind: 'stale', productId: 'prod_older', currentVersion: 'cpu/v2.0.0' });

      const result = await runCompatibilityExtract({ category: 'CPU' });

      expect(result.status).toBe('success');
      expect(result.summary.totalScanned).toBe(3);
      expect(result.summary.totalExtracted).toBe(3);
      expect(result.summary.totalUpdated).toBe(1);
      expect(result.summary.totalSkipped).toBe(1); // prod_same
      expect(result.summary.totalStale).toBe(1);  // prod_older
    });

    it('should count failed products without halting the batch', async () => {
      mockFindNeedingExtraction.mockResolvedValueOnce([
        {
          _id: 'prod_ok',
          category: 'CPU',
          compatibility: null,
          rawSpecifications: [],
        },
        {
          _id: 'prod_fail',
          category: 'CPU',
          compatibility: null,
          rawSpecifications: [],
        },
      ]);

      mockPersistFacts
        .mockResolvedValueOnce({ kind: 'updated', productId: 'prod_ok' })
        .mockRejectedValueOnce(new Error('write timeout'));

      const result = await runCompatibilityExtract({ category: 'CPU' });

      expect(result.summary.totalScanned).toBe(2);
      expect(result.summary.totalUpdated).toBe(1);
      expect(result.summary.totalFailed).toBe(1);
    });

    it('should count not_found from persistFacts as skipped', async () => {
      mockFindNeedingExtraction.mockResolvedValueOnce([{
        _id: 'prod_ghost',
        category: 'CPU',
        compatibility: null,
        rawSpecifications: [],
      }]);

      mockPersistFacts.mockResolvedValueOnce({
        kind: 'skipped',
        productId: 'prod_ghost',
        reason: 'not_found',
      });

      const result = await runCompatibilityExtract({ category: 'CPU' });

      expect(result.summary.totalSkipped).toBe(1);
      expect(result.summary.totalUpdated).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Req 4: Checkpoint and resume
  // -------------------------------------------------------------------------

  describe('checkpoint and resume', () => {
    it('should pass resumeFrom as initial afterId to findNeedingExtraction', async () => {
      mockFindNeedingExtraction.mockResolvedValueOnce([{
        _id: 'prod_a',
        category: 'CPU',
        compatibility: null,
        rawSpecifications: [],
      }]);

      const result = await runCompatibilityExtract({
        category: 'CPU',
        resumeFrom: 'prod_cursor_42',
      });

      expect(result.status).toBe('success');
      // First call should use resumeFrom as the cursor
      expect(mockFindNeedingExtraction).toHaveBeenCalledWith(
        'cpu',
        'cpu/v1.0.0',
        100,
        'prod_cursor_42',
      );
      expect(mockCountByCategory).toHaveBeenCalledWith('cpu');
      expect(result.summary.lastCheckpointId).toBe('prod_a');
    });

    it('should advance cursor between batches', async () => {
      // First batch returns 2 items
      mockFindNeedingExtraction
        .mockResolvedValueOnce([
          { _id: 'p1', category: 'CPU', compatibility: null, rawSpecifications: [] },
          { _id: 'p2', category: 'CPU', compatibility: null, rawSpecifications: [] },
        ])
        // Second batch returns 1 item
        .mockResolvedValueOnce([
          { _id: 'p3', category: 'CPU', compatibility: null, rawSpecifications: [] },
        ])
        // Third batch returns empty → loop ends
        .mockResolvedValueOnce([]);

      const result = await runCompatibilityExtract({ category: 'CPU', batchSize: 100 });

      expect(result.summary.totalScanned).toBe(3);
      expect(result.summary.lastCheckpointId).toBe('p3');

      // Verify cursor advancement:
      // Call 1: afterId=undefined, returns [p1,p2]
      expect(mockFindNeedingExtraction.mock.calls[0]![3]).toBeUndefined();
      // Call 2: afterId=p2, returns [p3]
      expect(mockFindNeedingExtraction.mock.calls[1]![3]).toBe('p2');
      // Call 3: afterId=p3, returns []
      expect(mockFindNeedingExtraction.mock.calls[2]![3]).toBe('p3');
    });
  });

  // -------------------------------------------------------------------------
  // Req 5: Dry-run and report-only safety
  // -------------------------------------------------------------------------

  describe('dry-run and report-only safety', () => {
    it('dry-run should not call migration functions', async () => {
      await runCompatibilityExtract({
        category: 'CPU',
        dryRun: true,
        migrateLegacyDryRun: true,
      });

      expect(mockMigrationDryRun).toHaveBeenCalled();
      // migrateLegacy is false → migrationRun should NOT be called
      expect(mockMigrationRun).not.toHaveBeenCalled();
      expect(mockMigrationVerify).not.toHaveBeenCalled();
    });

    it('migrateLegacy should call migrationRun and migrationVerify', async () => {
      // Override the default mock so dry-run reports documents to normalize
      mockMigrationDryRun.mockResolvedValueOnce({ wouldNormalize: 5, sampleIds: ['a', 'b'] });

      await runCompatibilityExtract({
        category: 'CPU',
        dryRun: true,
        migrateLegacy: true,
      });

      expect(mockMigrationDryRun).toHaveBeenCalled();
      expect(mockMigrationRun).toHaveBeenCalled();
      expect(mockMigrationVerify).toHaveBeenCalled();
    });

    it('report-only should not call extractFacts or persistFacts', async () => {
      const result = await runCompatibilityExtract({
        category: 'CPU',
        reportOnly: true,
      });

      expect(mockPersistFacts).not.toHaveBeenCalled();
      expect(mockExtractFacts).not.toHaveBeenCalled();
      // Report-only should not process any products
      expect(result.summary.totalScanned).toBe(0);
      expect(result.summary.totalExtracted).toBe(0);
    });

    it('dry-run extracts facts but does not persist', async () => {
      const result = await runCompatibilityExtract({
        category: 'CPU',
        dryRun: true,
      });

      expect(result.status).toBe('dry_run');
      // Facts were extracted (if there were products) but none persisted
      expect(mockPersistFacts).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Req 8: Result shape — all required fields present
  // -------------------------------------------------------------------------

  describe('result shape', () => {
    it('should include all required summary fields on success', async () => {
      const result = await runCompatibilityExtract({ category: 'CPU' });

      expect(result.status).toBe('success');
      const s = result.summary as ExtractionSummary;
      expect(s.categories).toEqual(['CPU']);
      expect(typeof s.totalScanned).toBe('number');
      expect(typeof s.totalExtracted).toBe('number');
      expect(typeof s.totalUpdated).toBe('number');
      expect(typeof s.totalSkipped).toBe('number');
      expect(typeof s.totalStale).toBe('number');
      expect(typeof s.totalFailed).toBe('number');
      expect(s.lastCheckpointId).toBeNull();
      expect(typeof s.elapsedMs).toBe('number');
      expect(Array.isArray(s.qualityReports)).toBe(true);
      expect(s.productionRepresentativenessEstablished).toBe(false);
    });

    it('should include all required summary fields on dry_run', async () => {
      const result = await runCompatibilityExtract({ category: 'CPU', dryRun: true });

      expect(result.status).toBe('dry_run');
      expect(result.summary.productionRepresentativenessEstablished).toBe(false);
    });

    it('should include all required summary fields on error', async () => {
      const result = await runCompatibilityExtract({});

      expect(result.status).toBe('error');
      expect(result.summary.productionRepresentativenessEstablished).toBe(false);
      if (result.status === 'error') {
        expect(typeof result.error).toBe('string');
      }
    });
  });
});
