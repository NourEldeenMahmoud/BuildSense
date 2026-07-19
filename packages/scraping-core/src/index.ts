export const SCRAPING_CORE_VERSION = '0.1.0';

export {
  SnapshotStore,
  computeContentHash,
  buildSnapshotFileName,
  hashUrlForFilename,
} from './snapshot-store.js';
export type {
  SnapshotWriteInput,
  SnapshotWriteResult,
  SnapshotReadResult,
} from './snapshot-store.js';
export { Orchestrator } from './orchestrator.js';
export type { OrchestratorConfig, RunCommand, RunResult, ProductPublishedEvent } from './orchestrator.js';
export { evaluateHealthGates, gateResultsToRecord } from './health-gates.js';
export type { HealthGateResult, HealthGateInput } from './health-gates.js';
export { evaluateRobotsPolicy, evaluateDisallowRules } from './robots-evaluator.js';
export type { RobotsDecision, RobotsEvalInput, RobotsEvalResult } from './robots-evaluator.js';
export {
  SigmaBootstrapImporter,
  calculateExpectedPages,
  generateCategoryPageUrls,
  computeMissingPages,
  dedupeCanonicalUrls,
  buildFetchPlan,
  detectSilentSkips,
} from './bootstrap-import.js';
export type {
  BootstrapImportConfig,
  BootstrapImportCommand,
  BootstrapImportManifest,
  BootstrapImportResult,
} from './bootstrap-import.js';
