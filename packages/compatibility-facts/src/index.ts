// ---------------------------------------------------------------------------
// @buildsense/compatibility-facts — public API
// ---------------------------------------------------------------------------

// Types
export type { SpecEntry, CategoryExtractor } from './types.js';
export {
  EXTRACTOR_VERSIONS,
  SUPPORTED_CATEGORIES,
} from './types.js';

// Dispatchers
export {
  extractFacts,
  isSupportedCategory,
  getExtractorVersion,
  SUPPORTED_CATEGORIES as DISPATCHER_CATEGORIES,
} from './dispatcher.js';

// Individual extractors
export { extractCpuFacts } from './extractors/cpu.js';
export { extractMotherboardFacts } from './extractors/motherboard.js';
export { extractRamFacts } from './extractors/ram.js';
export { extractGpuFacts } from './extractors/gpu.js';
export { extractStorageFacts } from './extractors/storage.js';
export { extractPsuFacts } from './extractors/psu.js';
export { extractCaseFacts } from './extractors/case.js';

// Helpers (for testing / advanced use)
export {
  findSpec,
  findAllMatches,
  detectConflict,
  normalizeValue,
  buildEvidence,
  buildFact,
  buildFactSet,
  parseNumber,
  parseBoolean,
  splitList,
  parsePowerConnectors,
} from './helpers.js';

// Aliases (for testing / advanced use)
export {
  SOCKET_ALIASES,
  FORM_FACTOR_ALIASES,
  GENERATION_ALIASES,
  INTERFACE_ALIASES,
} from './aliases/index.js';
