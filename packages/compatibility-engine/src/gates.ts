import type { CategoryQualityReport, ReferenceDataset } from '@buildsense/domain';

const COVERAGE_GATE = 0.8;
const PRECISION_GATE = 0.95;
const MIN_SAMPLE = 50;

export function passesFactQualityGate(
  reports: readonly CategoryQualityReport[],
  category: string,
  factKey: string,
): boolean {
  const report = reports.find((item) => item.category.toLowerCase() === category.toLowerCase());
  const metric = report?.factMetrics.find((item) => item.factKey === factKey);
  if (!report || !metric || metric.coverage < COVERAGE_GATE) return false;
  if (metric.precision === null || metric.precision < PRECISION_GATE) return false;
  if (metric.verifiedSampleSize === null) return false;
  return metric.verifiedSampleSize >= MIN_SAMPLE || metric.verifiedSampleSize >= report.totalProducts;
}

export function hasAuthoritativeCpuSupportData(
  dataset: ReferenceDataset | null | undefined,
): boolean {
  return Boolean(dataset?.citation.trim() && dataset.chipsetCpuSupport.length > 0);
}
