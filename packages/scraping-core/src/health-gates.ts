import type { ScrapeRunItemDocument, CategoryAuditEntry } from '@buildsense/database';

export interface HealthGateResult {
  gate: string;
  passed: boolean;
  severity: 'FAILED' | 'PARTIALLY_FAILED' | 'NO_BASELINE' | 'WARNING';
  detail?: string;
  reasonCode?: string;
}

export interface HealthGateInput {
  items: ScrapeRunItemDocument[];
  totalDiscovered: number;
  baseline?: {
    totalDiscovered: number;
    categoryAudit?: CategoryAuditEntry[];
    totalMissingPrice?: number;
  } | undefined;
  currentCategoryAudit?: CategoryAuditEntry[] | undefined;
  currentMissingPrice?: {
    missing: number;
    total: number;
  } | undefined;
}

const TITLE_MISSING_THRESHOLD = 0.10;
const HTTP_BLOCK_THRESHOLD = 0.10;
const BASELINE_DISCOVERY_MIN_RATIO = 0.40;
const MISSING_PRICE_NONZERO_BASELINE_GROWTH_THRESHOLD = 0.30;
const MISSING_PRICE_ZERO_BASELINE_COUNT_THRESHOLD = 3;
const MISSING_PRICE_ZERO_BASELINE_RATE_THRESHOLD = 0.05;

export function evaluateHealthGates(input: HealthGateInput): HealthGateResult[] {
  const results: HealthGateResult[] = [];

  results.push(evaluateEmptyDiscovery(input.totalDiscovered));
  results.push(evaluateMissingTitle(input.items));
  results.push(evaluateHttpBlocks(input.items));
  results.push(evaluateParserCritical(input.items));

  if (input.baseline !== undefined) {
    results.push(evaluateDiscoveryBaseline(input.totalDiscovered, input.baseline.totalDiscovered));
  } else {
    results.push({
      gate: 'discovery_baseline',
      passed: true,
      severity: 'NO_BASELINE',
      detail: 'No baseline available for comparison',
    });
  }

  // Empty category gate
  if (input.baseline?.categoryAudit !== undefined && input.currentCategoryAudit !== undefined) {
    results.push(evaluateEmptyCategory(input.baseline.categoryAudit, input.currentCategoryAudit));
  } else {
    results.push({
      gate: 'empty_category',
      passed: true,
      severity: 'NO_BASELINE',
      detail: 'No baseline category audit available for comparison',
    });
  }

  // Missing price gate
  if (input.currentMissingPrice !== undefined) {
    if (input.baseline?.totalMissingPrice !== undefined) {
      results.push(evaluateMissingPriceNonzeroBaseline(
        input.currentMissingPrice.missing,
        input.currentMissingPrice.total,
        input.baseline.totalMissingPrice,
      ));
    } else if (input.baseline !== undefined) {
      // Baseline exists but legacy document without missing price metric
      results.push({
        gate: 'missing_price',
        passed: true,
        severity: 'NO_BASELINE',
        detail: 'Baseline exists but missing price metric not available (legacy document)',
      });
    } else {
      // No baseline available for missing price comparison
      results.push({
        gate: 'missing_price',
        passed: true,
        severity: 'NO_BASELINE',
        detail: 'No baseline available for missing price comparison',
      });
    }
  } else {
    results.push({
      gate: 'missing_price',
      passed: true,
      severity: 'NO_BASELINE',
      detail: 'No missing price data available',
    });
  }

  return results;
}

function evaluateEmptyDiscovery(totalDiscovered: number): HealthGateResult {
  if (totalDiscovered > 0) {
    return { gate: 'empty_discovery', passed: true, severity: 'FAILED' };
  }
  return { gate: 'empty_discovery', passed: false, severity: 'FAILED', detail: 'Full run discovered zero products' };
}

function evaluateMissingTitle(items: ScrapeRunItemDocument[]): HealthGateResult {
  const fetched = items.filter((i) => i.fetchState === 'FETCHED');
  if (fetched.length === 0) {
    return { gate: 'missing_title', passed: true, severity: 'FAILED' };
  }

  const missingTitle = fetched.filter((i) => i.snapshotId === undefined || i.snapshotId === null).length;
  const rate = missingTitle / fetched.length;
  const passed = rate <= TITLE_MISSING_THRESHOLD;

  return {
    gate: 'missing_title',
    passed,
    severity: 'FAILED',
    ...(passed ? {} : { detail: `${(rate * 100).toFixed(1)}% of fetched pages missing title (threshold: ${(TITLE_MISSING_THRESHOLD * 100).toFixed(0)}%)` }),
  };
}

function evaluateHttpBlocks(items: ScrapeRunItemDocument[]): HealthGateResult {
  const total = items.length;
  if (total === 0) {
    return { gate: 'http_blocks', passed: true, severity: 'FAILED' };
  }

  const blocked = items.filter(
    (i) => i.failureKind === 'HTTP_4XX' || i.failureKind === 'HTTP_429',
  ).length;

  const rate = blocked / total;
  const passed = rate <= HTTP_BLOCK_THRESHOLD;

  return {
    gate: 'http_blocks',
    passed,
    severity: 'FAILED',
    ...(passed ? {} : { detail: `${(rate * 100).toFixed(1)}% of pages blocked (threshold: ${(HTTP_BLOCK_THRESHOLD * 100).toFixed(0)}%)` }),
  };
}

function evaluateParserCritical(items: ScrapeRunItemDocument[]): HealthGateResult {
  const fetched = items.filter((i) => i.fetchState === 'FETCHED');
  if (fetched.length === 0) {
    return { gate: 'parser_critical', passed: true, severity: 'FAILED' };
  }

  const critical = fetched.filter(
    (i) => i.snapshotId === undefined || i.snapshotId === null,
  ).length;

  return {
    gate: 'parser_critical',
    passed: critical === 0,
    severity: 'FAILED',
    ...(critical === 0 ? {} : { detail: `${critical} pages with critical parse failure` }),
  };
}

function evaluateDiscoveryBaseline(
  current: number,
  baseline: number,
): HealthGateResult {
  if (baseline === 0) {
    return { gate: 'discovery_baseline', passed: true, severity: 'NO_BASELINE', detail: 'Baseline discovery count is zero' };
  }

  const ratio = current / baseline;
  const passed = ratio >= BASELINE_DISCOVERY_MIN_RATIO;

  return {
    gate: 'discovery_baseline',
    passed,
    severity: 'FAILED',
    ...(passed ? {} : { detail: `Discovery count ${current} is ${(ratio * 100).toFixed(1)}% of baseline ${baseline} (threshold: ${(BASELINE_DISCOVERY_MIN_RATIO * 100).toFixed(0)}%)` }),
  };
}

function evaluateEmptyCategory(
  baselineAudit: CategoryAuditEntry[],
  currentAudit: CategoryAuditEntry[],
): HealthGateResult {
  const baselineBySeed = new Map<string, CategoryAuditEntry>();
  for (const entry of baselineAudit) {
    baselineBySeed.set(entry.seedId, entry);
  }

  const currentBySeed = new Map<string, CategoryAuditEntry>();
  for (const entry of currentAudit) {
    currentBySeed.set(entry.seedId, entry);
  }

  const emptyCategories: string[] = [];
  for (const [seedId, baselineEntry] of baselineBySeed) {
    if (baselineEntry.productsDiscovered > 0) {
      const currentEntry = currentBySeed.get(seedId);
      if (currentEntry === undefined || currentEntry.productsDiscovered === 0) {
        emptyCategories.push(seedId);
      }
    }
  }

  if (emptyCategories.length === 0) {
    return { gate: 'empty_category', passed: true, severity: 'FAILED' };
  }

  return {
    gate: 'empty_category',
    passed: false,
    severity: 'FAILED',
    detail: `Previously non-empty categories now empty: ${emptyCategories.join(', ')}`,
  };
}

function evaluateMissingPriceNonzeroBaseline(
  currentMissing: number,
  currentTotal: number,
  baselineMissing: number,
): HealthGateResult {
  if (baselineMissing === 0) {
    // Use zero-baseline policy when baseline had zero missing prices
    return evaluateMissingPriceZeroBaseline(currentMissing, currentTotal);
  }

  // Nonzero baseline: >30% count growth => PARTIALLY_FAILED
  const growthRate = baselineMissing > 0 ? (currentMissing - baselineMissing) / baselineMissing : 0;
  const passed = growthRate <= MISSING_PRICE_NONZERO_BASELINE_GROWTH_THRESHOLD;

  return {
    gate: 'missing_price',
    passed,
    severity: 'PARTIALLY_FAILED',
    ...(passed
      ? {}
      : {
          detail: `Missing price count ${currentMissing} is ${((growthRate) * 100).toFixed(1)}% growth from baseline ${baselineMissing} (threshold: ${(MISSING_PRICE_NONZERO_BASELINE_GROWTH_THRESHOLD * 100).toFixed(0)}%)`,
          reasonCode: 'MISSING_PRICE_GROWTH',
        }),
  };
}

function evaluateMissingPriceZeroBaseline(
  currentMissing: number,
  currentTotal: number,
): HealthGateResult {
  if (currentMissing === 0) {
    return { gate: 'missing_price', passed: true, severity: 'FAILED' };
  }

  if (currentTotal === 0) {
    // Zero denominator: treat as no missing prices
    return { gate: 'missing_price', passed: true, severity: 'FAILED' };
  }

  const rate = currentMissing / currentTotal;

  // count >= 3 OR rate > 5% => PARTIALLY_FAILED
  if (currentMissing >= MISSING_PRICE_ZERO_BASELINE_COUNT_THRESHOLD || rate > MISSING_PRICE_ZERO_BASELINE_RATE_THRESHOLD) {
    return {
      gate: 'missing_price',
      passed: false,
      severity: 'PARTIALLY_FAILED',
      detail: `Missing price count ${currentMissing} (${(rate * 100).toFixed(1)}% of ${currentTotal}) exceeds zero-baseline threshold`,
      reasonCode: 'ZERO_BASELINE_MISSING_PRICE_INCREASE',
    };
  }

  // count < 3 AND rate <= 5% => WARNING
  return {
    gate: 'missing_price',
    passed: true,
    severity: 'WARNING',
    detail: `Missing price count ${currentMissing} (${(rate * 100).toFixed(1)}% of ${currentTotal}) is below zero-baseline threshold`,
    reasonCode: 'ZERO_BASELINE_MISSING_PRICE_INCREASE',
  };
}

export function gateResultsToRecord(results: HealthGateResult[]): Record<string, boolean> {
  const record: Record<string, boolean> = {};
  for (const result of results) {
    record[result.gate] = result.passed;
  }
  return record;
}
